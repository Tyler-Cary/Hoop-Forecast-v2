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
    
    // 2. Get prediction (check cache using games hash)
    const gamesHash = createGamesHash(stats.games);
    let prediction = predictionsCache.get(playerName, gamesHash);
    if (!prediction) {
      console.log(`💾 Cache miss for prediction, generating...`);
      prediction = await predictPointsFromGames(stats.games, playerName);
      if (prediction) {
        predictionsCache.set(playerName, gamesHash, prediction);
        console.log(`✅ Cached prediction for ${playerName}`);
      }
    } else {
      console.log(`✅ Using cached prediction for ${playerName}`);
    }
    
    // Extract player name and team info
    const finalPlayerName = `${stats.player.first_name} ${stats.player.last_name}`.trim() || playerName;
    const teamAbbrev = typeof stats.player?.team === 'string' 
      ? stats.player.team 
      : stats.player?.team?.abbreviation || null;
    
    // 3. Get next game (check cache)
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
    
    // 4. Get betting odds (check cache, then provided line, then API)
    let odds = null;
    const providedBettingLine = req.query.betting_line ? parseFloat(req.query.betting_line) : null;
    const providedBookmaker = req.query.bookmaker || null;
    
    if (providedBettingLine != null && !isNaN(providedBettingLine)) {
      // Use provided line from homepage
      odds = {
        line: providedBettingLine,
        bookmaker: providedBookmaker || 'Unknown',
        source: 'homepage'
      };
      bettingLinesCache.set(finalPlayerName, providedBettingLine, providedBookmaker, 'homepage', null, teamAbbrev, nextGame?.opponent);
      console.log(`✅ Using betting line from homepage: ${providedBettingLine}`);
    } else {
      // Check cache first
      odds = bettingLinesCache.get(finalPlayerName, teamAbbrev, nextGame?.opponent);
      if (!odds) {
        console.log(`💾 Cache miss for odds, fetching from API...`);
        try {
          const oddsResult = await getPlayerOdds(null, finalPlayerName, {
            teamAbbrev: teamAbbrev,
            opponentAbbrev: nextGame?.opponent || null
          });
          if (oddsResult && oddsResult.line) {
            odds = oddsResult;
            bettingLinesCache.set(
              finalPlayerName, 
              oddsResult.line, 
              oddsResult.bookmaker, 
              'api', 
              oddsResult.event_id,
              teamAbbrev, 
              nextGame?.opponent
            );
            console.log(`✅ Cached odds for ${finalPlayerName}`);
          }
        } catch (oddsError) {
          console.log(`⚠️ Could not fetch odds: ${oddsError.message}`);
        }
      } else {
        console.log(`✅ Using cached odds for ${finalPlayerName}`);
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

    // Determine recommendation
    let recommendation = 'N/A';
    const predictedPoints = prediction?.predicted_points || prediction?.predictedPoints || null;
    const bettingLine = odds?.line || null;
    
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
      betting_line: bettingLine,
      recommendation,
      confidence: prediction?.confidence || null,
      error_margin: prediction?.error_margin || prediction?.errorMargin || null,
      next_game: nextGame ? {
        ...nextGame,
        opponent_logo: getTeamLogo(opponentTeam),
        opponent_name: getTeamName(opponentTeam)
      } : null,
      player_team: finalPlayerTeam,
      player_team_logo: getTeamLogo(finalPlayerTeam),
      player_team_name: getTeamName(finalPlayerTeam),
      odds_source: odds?.source || null,
      odds_bookmaker: odds?.bookmaker || null,
      odds_error: odds ? null : 'No betting line available',
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

export { router as playerRoutes };
