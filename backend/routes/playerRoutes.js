import express from 'express';
import { getPlayerStatsFromNBA } from '../services/nbaApiService.js';
import { getPlayerOdds } from '../services/oddsService.js';
import { predictPointsFromGames } from '../services/predictionService.js';
import { 
  playerStatsCache, 
  predictionsCache, 
  bettingLinesCache, 
  nextGamesCache,
  playersWithLinesCache,
  imageMetadataCache,
  createGamesHash 
} from '../services/databaseService.js';
import { getImageUrl, imageExists } from '../services/imageStorageService.js';
import { 
  getAccuracyStats, 
  updatePredictionOutcome, 
  getPendingEvaluations,
  exportForFineTuning 
} from '../services/predictionTrackingService.js';
import { 
  evaluatePendingPredictions,
  evaluatePredictionById,
  evaluatePredictionByGame
} from '../services/predictionEvaluationService.js';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const router = express.Router();
const THE_ODDS_API_KEY = process.env.THE_ODDS_API_KEY || process.env.ODDS_API_KEY;
const THE_ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

/**
 * GET /api/player/with-lines
 * Get list of players with current betting lines available
 */
router.get('/with-lines', async (req, res) => {
  try {
    if (!THE_ODDS_API_KEY) {
      return res.json([]); // Return empty if no API key
    }

    // Check cache first
    const cached = playersWithLinesCache.get();
    if (cached) {
      console.log('✅ Using cached players with lines');
      return res.json(cached);
    }

    console.log('📊 Fetching players with betting lines from API...');

    // Step 1: Get all NBA events
    const eventsResponse = await axios.get(`${THE_ODDS_API_BASE}/sports/basketball_nba/events`, {
      params: { apiKey: THE_ODDS_API_KEY },
      timeout: 15000
    });

    if (!eventsResponse.data || !Array.isArray(eventsResponse.data)) {
      return res.json([]);
    }

    const events = eventsResponse.data.slice(0, 10); // Limit to first 10 events to avoid too many API calls
    console.log(`📋 Found ${events.length} events, checking for player props...`);

    const playersWithLines = [];
    const seenPlayers = new Set();

    // Step 2: For each event, get player props (collect players first, images later)
    for (const event of events) {
      try {
        const oddsResponse = await axios.get(
          `${THE_ODDS_API_BASE}/sports/basketball_nba/events/${event.id}/odds`,
          {
            params: {
              apiKey: THE_ODDS_API_KEY,
              regions: 'us',
              markets: 'player_points',
              oddsFormat: 'american'
            },
            timeout: 10000
          }
        );

        if (!oddsResponse.data) {
          console.log(`⚠️ No data for event ${event.id}`);
          continue;
        }

        if (!oddsResponse.data.bookmakers || oddsResponse.data.bookmakers.length === 0) {
          console.log(`⚠️ No bookmakers for event ${event.id} (${event.home_team} vs ${event.away_team})`);
          continue;
        }

        console.log(`📊 Event ${event.id}: Found ${oddsResponse.data.bookmakers.length} bookmakers`);

        // Extract players from bookmakers
        let playersFoundInEvent = 0;
        for (const bookmaker of oddsResponse.data.bookmakers) {
          for (const market of bookmaker.markets || []) {
            if (market.key !== 'player_points') continue;

            for (const outcome of market.outcomes || []) {
              const playerName = outcome.description;
              if (!playerName || seenPlayers.has(playerName.toLowerCase())) continue;

              // Get the line from the first outcome (over or under, same point value)
              const line = parseFloat(outcome.point);
              if (isNaN(line) || line <= 0) continue;

              seenPlayers.add(playerName.toLowerCase());
              playersFoundInEvent++;
              
              // Store player data (images will be fetched in parallel after)
              playersWithLines.push({
                name: playerName,
                betting_line: line,
                bookmaker: bookmaker.title || bookmaker.key,
                event_id: event.id,
                home_team: event.home_team,
                away_team: event.away_team,
                commence_time: event.commence_time,
                player_image: null // Will be fetched on frontend
              });
            }
          }
        }
        
        if (playersFoundInEvent > 0) {
          console.log(`✅ Found ${playersFoundInEvent} players in event ${event.id}`);
        }
      } catch (err) {
        // Log the error to see what's happening
        if (err.response) {
          console.log(`❌ Error fetching odds for event ${event.id}: ${err.response.status} - ${err.response.statusText}`);
          if (err.response.data) {
            console.log(`   Error data:`, JSON.stringify(err.response.data).substring(0, 200));
          }
        } else {
          console.log(`❌ Error fetching odds for event ${event.id}: ${err.message}`);
        }
        // Skip events that fail (no player props available or quota exceeded)
        continue;
      }
    }

    // Step 3: Download and store player images locally (using ESPN to avoid NBA.com rate limits)
    console.log(`🖼️ Downloading images for ${playersWithLines.length} players...`);
    const { downloadPlayerImage, getImageUrl, imageExists } = await import('../services/imageStorageService.js');
    const { searchPlayersESPN } = await import('../services/nbaApiService.js');
    
    // Process images in smaller batches to avoid overwhelming APIs
    const batchSize = 5;
    for (let i = 0; i < playersWithLines.length; i += batchSize) {
      const batch = playersWithLines.slice(i, i + batchSize);
      
      await Promise.allSettled(
        batch.map(async (player) => {
          try {
            // Check if image already exists locally
            if (imageExists(player.name)) {
              player.player_image = getImageUrl(player.name);
              return;
            }
            
            // Use ESPN search to find player (more reliable than NBA.com)
            const espnResults = await searchPlayersESPN(player.name);
            if (espnResults && espnResults.length > 0) {
              const espnPlayer = espnResults[0];
              
              // Try to get NBA ID from ESPN player data if available
              // ESPN sometimes includes external IDs, but we'll need to search NBA.com
              // For now, try NBA.com search with short timeout
              try {
                const { searchPlayer } = await import('../services/nbaApiService.js');
                const searchPromise = searchPlayer(player.name);
                const timeoutPromise = new Promise((_, reject) => 
                  setTimeout(() => reject(new Error('timeout')), 3000)
                );
                
                const nbaPlayer = await Promise.race([searchPromise, timeoutPromise]);
                if (nbaPlayer && nbaPlayer.id) {
                  const imageUrl = await downloadPlayerImage(player.name, nbaPlayer.id);
                  if (imageUrl) {
                    player.player_image = imageUrl;
                  }
                }
              } catch (nbaError) {
                // If NBA.com search fails, skip image for this player
                // They'll just use initials
              }
            }
          } catch (error) {
            // Silently fail - player will just have no image
          }
        })
      );
      
      // Small delay between batches to avoid rate limiting
      if (i + batchSize < playersWithLines.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    const playersWithImages = playersWithLines.filter(p => p.player_image).length;
    console.log(`✅ Stored images for ${playersWithImages}/${playersWithLines.length} players locally`);

    console.log(`✅ Found ${playersWithLines.length} players with betting lines`);
    
    // Cache the results
    playersWithLinesCache.set(playersWithLines);
    
    res.json(playersWithLines);
  } catch (error) {
    console.error('❌ Error fetching players with lines:', error.message);
    res.json([]); // Return empty array on error
  }
});

/**
 * GET /api/player/:id/stats
 * Fetch last 10 games for a player
 * Requires player name as query parameter
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const playerName = req.query.name;
    if (!playerName) {
      return res.status(400).json({ error: 'Player name (name query parameter) is required' });
    }
    const stats = await getPlayerStatsFromNBA(playerName);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching player stats:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch player stats' });
  }
});

/**
 * GET /api/player/:id/prediction
 * Compute prediction from player stats
 * Requires player name as query parameter
 */
router.get('/:id/prediction', async (req, res) => {
  try {
    const playerName = req.query.name;
    if (!playerName) {
      return res.status(400).json({ error: 'Player name (name query parameter) is required' });
    }
    const stats = await getPlayerStatsFromNBA(playerName);
    if (!stats.games || stats.games.length < 3) {
      return res.status(400).json({ error: `Insufficient game data. Need at least 3 games, got ${stats.games?.length || 0}` });
    }
    const prediction = await predictPointsFromGames(stats.games, playerName);
    res.json(prediction);
  } catch (error) {
    console.error('Error generating prediction:', error);
    res.status(500).json({ error: error.message || 'Failed to generate prediction' });
  }
});

/**
 * GET /api/player/:id/odds
 * Fetch player prop line from The Odds API
 */
router.get('/:id/odds', async (req, res) => {
  try {
    const playerId = req.params.id;
    const odds = await getPlayerOdds(playerId);
    res.json(odds);
  } catch (error) {
    console.error('Error fetching odds:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch odds' });
  }
});

/**
 * GET /api/player/:id/compare
 * Return combined object with stats, prediction, odds, and recommendation
 * Requires player name as query parameter
 */
router.get('/:id/compare', async (req, res) => {
  try {
    const playerName = req.query.name;
    if (!playerName) {
      return res.status(400).json({ error: 'Player name (name query parameter) is required' });
    }
    
    console.log(`📊 Fetching compare data for player: ${playerName}`);
    
    // 1. Get player stats (check cache first)
    let stats = playerStatsCache.get(playerName);
    if (!stats) {
      console.log(`💾 Cache miss for stats, fetching from API...`);
      stats = await getPlayerStatsFromNBA(playerName);
      if (stats) {
        const nbaPlayerId = stats.player?.nba_id || stats.player?.id;
        const teamAbbrev = typeof stats.player?.team === 'string' 
          ? stats.player.team 
          : stats.player?.team?.abbreviation;
        playerStatsCache.set(playerName, stats, nbaPlayerId, teamAbbrev);
        console.log(`✅ Cached stats for ${playerName}`);
      }
    } else {
      console.log(`✅ Using cached stats for ${playerName}`);
    }
    
    if (!stats || !stats.games || stats.games.length < 3) {
      throw new Error(`Insufficient game data. Need at least 3 games, got ${stats?.games?.length || 0}.`);
    }
    
    // Extract player name and team info
    const finalPlayerName = `${stats.player.first_name} ${stats.player.last_name}`.trim() || playerName;
    const teamAbbrev = typeof stats.player?.team === 'string' 
      ? stats.player.team 
      : stats.player?.team?.abbreviation || null;
    
    // 2. Get next game (check cache) - needed for prediction tracking
    let nextGame = null;
    if (teamAbbrev && teamAbbrev !== 'N/A') {
      nextGame = nextGamesCache.get(teamAbbrev);
      if (!nextGame) {
        console.log(`💾 Cache miss for next game, fetching...`);
        const { getNextGame } = await import('../services/nbaApiService.js');
        nextGame = await getNextGame(null, teamAbbrev);
        if (nextGame) {
          nextGamesCache.set(teamAbbrev, nextGame);
          console.log(`✅ Cached next game for ${teamAbbrev}`);
        }
      } else {
        console.log(`✅ Using cached next game for ${teamAbbrev}`);
      }
    }
    
    // 2b. Get team records for player's team and opponent
    let playerTeamRecord = null;
    let opponentRecord = null;
    if (teamAbbrev && teamAbbrev !== 'N/A') {
      const { getTeamRecord } = await import('../services/nbaApiService.js');
      playerTeamRecord = await getTeamRecord(teamAbbrev);
      if (playerTeamRecord) {
        console.log(`✅ Found team record for ${teamAbbrev}: ${playerTeamRecord}`);
      }
    }
    if (nextGame && nextGame.opponent) {
      const { getTeamRecord } = await import('../services/nbaApiService.js');
      opponentRecord = await getTeamRecord(nextGame.opponent);
      if (opponentRecord) {
        console.log(`✅ Found opponent record for ${nextGame.opponent}: ${opponentRecord}`);
      }
    }
    
    // 3. Get prediction (check cache using games hash)
    // Prepare next game info for tracking
    const nextGameInfo = nextGame ? {
      date: nextGame.date || null,
      opponent: nextGame.opponent || null,
      isHome: nextGame.isHome || null,
      team: teamAbbrev || null
    } : null;
    
    const gamesHash = createGamesHash(stats.games);
    let prediction = predictionsCache.get(playerName, gamesHash);
    if (!prediction) {
      console.log(`💾 Cache miss for prediction, generating...`);
      prediction = await predictPointsFromGames(stats.games, playerName, nextGameInfo);
      if (prediction) {
        predictionsCache.set(playerName, gamesHash, prediction);
        console.log(`✅ Cached prediction for ${playerName}`);
      }
    } else {
      console.log(`✅ Using cached prediction for ${playerName}`);
    }
    
    // 4. Get betting odds (check cache, then provided line with validation, then API)
    // Now returns an object with all props: { points: {...}, assists: {...}, rebounds: {...}, etc. }
    let allProps = {}; // Initialize to empty object
    let odds = null; // Backward compatibility: points prop only
    const providedBettingLine = req.query.betting_line ? parseFloat(req.query.betting_line) : null;
    const providedBookmaker = req.query.bookmaker || null;
    
    // Calculate player's recent average for validation
    const recentGames = stats.games.slice(0, 10); // Last 10 games
    const recentAvg = recentGames.length > 0
      ? recentGames.reduce((sum, game) => sum + (parseFloat(game.points) || 0), 0) / recentGames.length
      : null;
    
    if (providedBettingLine != null && !isNaN(providedBettingLine)) {
      // Validate the provided line before using it
      const predictionPoints = prediction?.predicted_points || prediction?.predictedPoints || null;
      let lineIsValid = true;
      let validationReason = '';
      
      // Check 1: Is line suspiciously low (< 8)?
      if (providedBettingLine < 8) {
        lineIsValid = false;
        validationReason = `Line (${providedBettingLine}) is suspiciously low (< 8)`;
      }
      // Check 2: Is line way different from prediction (> 10 points difference)?
      else if (predictionPoints && Math.abs(providedBettingLine - predictionPoints) > 10) {
        lineIsValid = false;
        validationReason = `Line (${providedBettingLine}) differs significantly from prediction (${predictionPoints.toFixed(1)})`;
      }
      // Check 3: Is line way higher than recent average (> 10 points above average)?
      else if (recentAvg && providedBettingLine > recentAvg + 10) {
        lineIsValid = false;
        validationReason = `Line (${providedBettingLine}) is much higher than recent average (${recentAvg.toFixed(1)})`;
      }
      // Check 3b: Is line way lower than recent average (> 8 points below average)?
      else if (recentAvg && providedBettingLine < recentAvg - 8) {
        lineIsValid = false;
        validationReason = `Line (${providedBettingLine}) is much lower than recent average (${recentAvg.toFixed(1)})`;
      }
      // Check 4: Is line suspiciously high (> 60)?
      else if (providedBettingLine > 60) {
        lineIsValid = false;
        validationReason = `Line (${providedBettingLine}) is suspiciously high (> 60)`;
      }
      
      if (lineIsValid) {
        // Use provided line from homepage (create points prop only for backward compatibility)
        odds = {
          line: providedBettingLine,
          bookmaker: providedBookmaker || 'Unknown',
          source: 'homepage'
        };
        allProps = {
          points: odds
        };
        bettingLinesCache.set(finalPlayerName, providedBettingLine, providedBookmaker, 'homepage', null, teamAbbrev, nextGame?.opponent);
        console.log(`✅ Using betting line from homepage: ${providedBettingLine}`);
      } else {
        // Reject suspicious line and fetch from API instead
        console.log(`⚠️  Rejecting homepage line: ${validationReason}`);
        console.log(`   📊 Prediction: ${predictionPoints?.toFixed(1) || 'N/A'}, Recent avg: ${recentAvg?.toFixed(1) || 'N/A'}`);
        console.log(`   🔄 Fetching fresh line from API instead...`);
        // Fall through to API fetch below
      }
    }
    
    // Always try to fetch other props from API, even if we have points from homepage
    // This ensures we get assists, rebounds, steals, blocks, threes, and combined props
    const hasOnlyHomepagePoints = Object.keys(allProps).length === 1 && allProps.points && allProps.points.source === 'homepage';
    
    if (Object.keys(allProps).length === 0 || hasOnlyHomepagePoints) {
      // If we only have homepage points, we still want to fetch other props from API
      if (hasOnlyHomepagePoints) {
        console.log(`📊 Have homepage points prop, fetching other props from API...`);
      }
      
      // Check cache first (for backward compatibility, cache still stores single points line)
      const cachedOdds = bettingLinesCache.get(finalPlayerName, teamAbbrev, nextGame?.opponent);
      if (cachedOdds && cachedOdds.line && Object.keys(allProps).length === 0) {
        // Convert cached single prop to new format (only if we don't already have points from homepage)
        allProps = {
          points: cachedOdds
        };
        odds = cachedOdds;
        console.log(`✅ Using cached odds for ${finalPlayerName}`);
      }
      
      // Always try to fetch from The Odds API to get all available props
      // This will merge with existing props (e.g., if we have points from homepage, we'll add other props)
      try {
        console.log(`🔍 Fetching all props from The Odds API for ${finalPlayerName}...`);
        const oddsResult = await getPlayerOdds(null, finalPlayerName, {
          teamAbbrev: teamAbbrev,
          opponentAbbrev: nextGame?.opponent || null
        });
        if (oddsResult && typeof oddsResult === 'object' && Object.keys(oddsResult).length > 0) {
          // Merge API results with existing props (homepage points will be kept if API doesn't have points)
          // API props take precedence for non-points props
          for (const [propType, propData] of Object.entries(oddsResult)) {
            if (propType === 'points' && allProps.points && allProps.points.source === 'homepage') {
              // Keep homepage points if it exists, but still add other props from API
              console.log(`📌 Keeping homepage points prop, adding API ${propType} prop`);
            } else {
              // Add or update prop from API
              allProps[propType] = propData;
            }
          }
          
          // Extract points prop for backward compatibility (use API points if available, otherwise homepage)
          odds = oddsResult.points || allProps.points || null;
          
          // Cache the points prop for backward compatibility
          if (odds && odds.line) {
            bettingLinesCache.set(
              finalPlayerName, 
              odds.line, 
              odds.bookmaker, 
              odds.source || 'api', 
              odds.event_id,
              teamAbbrev, 
              nextGame?.opponent
            );
          }
          console.log(`✅ Fetched props from API for ${finalPlayerName} (found ${Object.keys(oddsResult).length} prop types from API, total: ${Object.keys(allProps).length})`);
        } else {
          console.log(`⚠️ API returned no props for ${finalPlayerName}`);
        }
      } catch (oddsError) {
        console.log(`⚠️ Could not fetch odds from API: ${oddsError.message}`);
        // Keep existing props (e.g., points from homepage) if API call fails
      }
    }

    console.log('Stats:', stats ? 'OK' : 'Failed');
    console.log('Prediction:', prediction ? 'OK' : 'Failed');
    console.log('Odds:', odds ? 'OK' : 'Unavailable');

    // Use the playerName we already extracted, or fallback
    if (!playerName) {
      playerName = 'Unknown';
      if (stats?.player) {
        playerName = typeof stats.player === 'string' 
          ? stats.player 
          : `${stats.player.first_name || ''} ${stats.player.last_name || ''}`.trim();
      } else if (prediction?.player) {
        playerName = prediction.player;
      } else if (odds?.player) {
        playerName = odds.player;
      }
    }

    // Determine recommendation (based on points prop)
    let recommendation = 'N/A';
    const predictedPoints = prediction?.predicted_points || prediction?.predictedPoints || null;
    const bettingLine = odds?.line || (allProps?.points?.line) || null;
    
    if (predictedPoints !== null && bettingLine !== null) {
      if (predictedPoints > bettingLine) {
        recommendation = 'OVER';
      } else if (predictedPoints < bettingLine) {
        recommendation = 'UNDER';
      } else {
        recommendation = 'PUSH';
      }
    }

    // Get team logos
    const { getTeamLogo, getTeamName } = await import('../services/teamLogoService.js');
    
    const opponentTeam = nextGame?.opponent || null;
    
    // Get player team from stats
    let finalPlayerTeam = null;
    if (stats?.player) {
      if (typeof stats.player === 'object') {
        finalPlayerTeam = stats.player.team || stats.player.team?.abbreviation || null;
      }
    }
    // Fallback to prediction
    if (!finalPlayerTeam && prediction?.player_team) {
      finalPlayerTeam = prediction.player_team;
    }
    
    const response = {
      player: finalPlayerName,
      stats: stats?.games || stats?.stats || [],
      prediction: predictedPoints,
      betting_line: bettingLine, // Backward compatibility: points line only
      recommendation,
      confidence: prediction?.confidence || null,
      error_margin: prediction?.error_margin || prediction?.errorMargin || null,
      next_game: nextGame ? {
        ...nextGame,
        opponent_logo: getTeamLogo(opponentTeam),
        opponent_name: getTeamName(opponentTeam),
        opponent_record: opponentRecord
      } : null,
      player_team: finalPlayerTeam,
      player_team_logo: getTeamLogo(finalPlayerTeam),
      player_team_name: getTeamName(finalPlayerTeam),
      player_team_record: playerTeamRecord,
      odds_source: odds?.source || null,
      odds_bookmaker: odds?.bookmaker || null,
      odds_error: odds ? null : 'No betting line available',
      // New: All available props
      props: (() => {
        console.log(`📊 Returning props for ${finalPlayerName}:`, Object.keys(allProps || {}));
        console.log(`📊 Props details:`, JSON.stringify(allProps, null, 2));
        return allProps || {};
      })(),
      player_image: (() => {
        // Check cache first for image metadata
        const imageMeta = imageMetadataCache.get(finalPlayerName);
        if (imageMeta && imageMeta.hasImage) {
          return imageMeta.imageUrl;
        }
        
        // Check if local image exists
        if (imageExists(finalPlayerName)) {
          const localUrl = getImageUrl(finalPlayerName);
          imageMetadataCache.set(finalPlayerName, localUrl, stats?.player?.nba_id || stats?.player?.id);
          return localUrl;
        }
        
        // Fallback to NBA.com CDN if we have player ID
        const nbaId = stats?.player?.nba_id || stats?.player?.id;
        if (nbaId) {
          const cdnUrl = `https://cdn.nba.com/headshots/nba/latest/260x190/${nbaId}.png`;
          // Cache that we're using CDN (but mark as not local)
          imageMetadataCache.set(finalPlayerName, cdnUrl, nbaId);
          return cdnUrl;
        }
        
        // No image available
        imageMetadataCache.setNoImage(finalPlayerName);
        return null;
      })()
    };

    console.log('Sending response:', JSON.stringify(response, null, 2));
    res.json(response);
  } catch (error) {
    console.error('Error in compare endpoint:', error);
    console.error('Stack:', error.stack);
    res.status(500).json({ 
      error: error.message || 'Failed to compare prediction and odds',
      player: 'Unknown',
      stats: [],
      prediction: null,
      betting_line: null,
      recommendation: 'N/A'
    });
  }
});

/**
 * GET /api/player/tracking/stats
 * Get prediction accuracy statistics
 */
router.get('/tracking/stats', async (req, res) => {
  try {
    const stats = getAccuracyStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting accuracy stats:', error);
    res.status(500).json({ error: error.message || 'Failed to get accuracy stats' });
  }
});

/**
 * GET /api/player/tracking/pending
 * Get predictions that need evaluation
 */
router.get('/tracking/pending', async (req, res) => {
  try {
    const pending = getPendingEvaluations();
    res.json({ count: pending.length, predictions: pending });
  } catch (error) {
    console.error('Error getting pending evaluations:', error);
    res.status(500).json({ error: error.message || 'Failed to get pending evaluations' });
  }
});

/**
 * POST /api/player/tracking/update
 * Update a prediction with actual outcome
 * Body: { predictionId: string, actualPoints: number }
 */
router.post('/tracking/update', async (req, res) => {
  try {
    const { predictionId, actualPoints } = req.body;
    
    if (!predictionId || actualPoints === undefined || actualPoints === null) {
      return res.status(400).json({ 
        error: 'predictionId and actualPoints are required' 
      });
    }
    
    if (typeof actualPoints !== 'number' || actualPoints < 0) {
      return res.status(400).json({ 
        error: 'actualPoints must be a non-negative number' 
      });
    }
    
    const updated = updatePredictionOutcome(predictionId, actualPoints);
    
    if (!updated) {
      return res.status(404).json({ error: 'Prediction not found' });
    }
    
    res.json({
      success: true,
      prediction: updated
    });
  } catch (error) {
    console.error('Error updating prediction outcome:', error);
    res.status(500).json({ error: error.message || 'Failed to update prediction outcome' });
  }
});

/**
 * GET /api/player/tracking/export
 * Export predictions for fine-tuning
 * Query params: 
 *   - minAccuracy (optional, default 70)
 *   - model (optional, 'gpt-4o-mini' or 'gpt-4o', default: 'gpt-4o-mini')
 */
router.get('/tracking/export', async (req, res) => {
  try {
    const minAccuracy = parseInt(req.query.minAccuracy) || 70;
    const model = req.query.model === 'gpt-4o' ? 'gpt-4o' : 'gpt-4o-mini';
    const exportData = exportForFineTuning(minAccuracy, model);
    
    if (exportData.message) {
      return res.json(exportData);
    }
    
    res.json({
      count: exportData.count,
      format: exportData.format,
      model: exportData.model,
      filename: exportData.filename,
      recommended_model: exportData.recommended_model,
      data: exportData.data, // Include full data array for fine-tuning
      preview: exportData.data.slice(0, 3), // Show first 3 examples for preview
      message: `Export ready with ${exportData.count} examples for ${model}. Use the data array for fine-tuning.`
    });
  } catch (error) {
    console.error('Error exporting for fine-tuning:', error);
    res.status(500).json({ error: error.message || 'Failed to export data' });
  }
});

/**
 * POST /api/player/tracking/evaluate
 * Automatically evaluate all pending predictions by fetching actual game results
 * This may take a while as it fetches data from NBA.com for each prediction
 */
router.post('/tracking/evaluate', async (req, res) => {
  try {
    console.log('🚀 Manual evaluation triggered via API');
    const results = await evaluatePendingPredictions();
    res.json({
      success: true,
      ...results,
      message: `Evaluation complete: ${results.evaluated} evaluated, ${results.failed} failed, ${results.skipped} skipped`
    });
  } catch (error) {
    console.error('Error evaluating predictions:', error);
    res.status(500).json({ error: error.message || 'Failed to evaluate predictions' });
  }
});

/**
 * POST /api/player/tracking/evaluate/:id
 * Evaluate a specific prediction by ID with actual points
 * Body: { actualPoints: number }
 */
router.post('/tracking/evaluate/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { actualPoints } = req.body;
    
    if (actualPoints === undefined || actualPoints === null) {
      return res.status(400).json({ error: 'actualPoints is required' });
    }
    
    if (typeof actualPoints !== 'number' || actualPoints < 0) {
      return res.status(400).json({ error: 'actualPoints must be a non-negative number' });
    }
    
    const result = await evaluatePredictionById(id, actualPoints);
    
    if (!result.success) {
      return res.status(404).json(result);
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error evaluating prediction:', error);
    res.status(500).json({ error: error.message || 'Failed to evaluate prediction' });
  }
});

export { router as playerRoutes };
