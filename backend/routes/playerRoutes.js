import express from 'express';
import { getPlayerStats } from '../services/balldontlieService.js';
import { getPlayerOdds } from '../services/oddsService.js';
import { predictPoints } from '../services/predictionService.js';

const router = express.Router();

/**
 * GET /api/player/:id/stats
 * Fetch last 10 games for a player
 */
router.get('/:id/stats', async (req, res) => {
  try {
    const playerId = req.params.id;
    const stats = await getPlayerStats(playerId);
    res.json(stats);
  } catch (error) {
    console.error('Error fetching player stats:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch player stats' });
  }
});

/**
 * GET /api/player/:id/prediction
 * Compute linear regression and return prediction
 */
router.get('/:id/prediction', async (req, res) => {
  try {
    const playerId = req.params.id;
    const prediction = await predictPoints(playerId);
    res.json(prediction);
  } catch (error) {
    console.error('Error generating prediction:', error);
    res.status(500).json({ error: error.message || 'Failed to generate prediction' });
  }
});

/**
 * GET /api/player/:id/odds
 * Fetch player prop line from TheOddsAPI
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
 */
router.get('/:id/compare', async (req, res) => {
  try {
    const playerId = req.params.id;
    console.log(`Fetching compare data for player ID: ${playerId}`);
    
    // Fetch stats and prediction in parallel
    const [statsResult, predictionResult] = await Promise.allSettled([
      getPlayerStats(playerId),
      predictPoints(playerId)
    ]);
    
    const stats = statsResult.status === 'fulfilled' ? statsResult.value : null;
    const prediction = predictionResult.status === 'fulfilled' ? predictionResult.value : null;
    
    // Extract player name for odds lookup - try multiple sources
    let playerName = null;
    
    // First try from stats
    if (stats?.player) {
      if (typeof stats.player === 'string') {
        playerName = stats.player;
      } else {
        playerName = `${stats.player.first_name || ''} ${stats.player.last_name || ''}`.trim();
      }
    }
    
    // If stats failed, try from prediction
    if (!playerName && prediction?.player) {
      playerName = prediction.player;
    }
    
    // If still no name, try to get it from balldontlie API directly
    if (!playerName) {
      try {
        const axios = (await import('axios')).default;
        const BALLDONTLIE_API_KEY = process.env.BALLDONTLIE_API_KEY;
        const response = await axios.get(`https://api.balldontlie.io/v1/players/${playerId}`, {
          headers: BALLDONTLIE_API_KEY ? { Authorization: BALLDONTLIE_API_KEY } : {},
          timeout: 5000
        });
        if (response.data && response.data.data) {
          const player = response.data.data;
          playerName = `${player.first_name || ''} ${player.last_name || ''}`.trim();
        }
      } catch (searchError) {
        console.log('Could not fetch player name from API:', searchError.message);
      }
    }
    
    // If still no name, use a fallback
    if (!playerName) {
      playerName = `Player ${playerId}`;
      console.log(`⚠️ Could not determine player name, using fallback: ${playerName}`);
    }
    
    console.log(`📝 Using player name: ${playerName}`);
    
    // Fetch odds from API - MUST use API, no fallback estimation
    let odds = null;
    try {
      odds = await getPlayerOdds(playerId, playerName);
      if (!odds || !odds.line) {
        throw new Error('API returned no line for player');
      }
      console.log(`✅ Got odds from API: ${odds.line} for ${playerName}`);
    } catch (oddsError) {
      console.error('❌ Failed to get odds from API:', oddsError.message);
      // Don't use fallback - throw error so user knows API isn't working
      throw new Error(`Unable to fetch betting line from API for ${playerName || 'player'}. Please check API configuration or try again later.`);
    }

    console.log('Stats:', stats ? 'OK' : 'Failed');
    console.log('Prediction:', prediction ? 'OK' : 'Failed');
    console.log('Odds:', odds ? 'OK' : 'Failed');

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

    // Get next game info (if available)
    let nextGame = null;
    try {
      const { getNextGame, searchPlayer } = await import('../services/nbaApiService.js');
      
      // Get player's team abbreviation
      const teamAbbrev = stats?.player?.team || 
                        (typeof stats?.player === 'object' && stats.player.team) ||
                        'N/A';
      
      if (teamAbbrev && teamAbbrev !== 'N/A' && playerName) {
        // Search for NBA.com player ID
        const nbaPlayer = await searchPlayer(playerName);
        if (nbaPlayer && nbaPlayer.id) {
          nextGame = await getNextGame(nbaPlayer.id, teamAbbrev);
          if (nextGame) {
            console.log(`✅ Next game: vs ${nextGame.opponent} on ${nextGame.date}`);
          }
        }
      }
    } catch (nextGameError) {
      console.log('Could not fetch next game info:', nextGameError.message);
    }
    
    const response = {
      player: playerName,
      stats: stats?.games || stats?.stats || [],
      prediction: predictedPoints,
      betting_line: bettingLine,
      recommendation,
      confidence: prediction?.confidence || null,
      error_margin: prediction?.error_margin || prediction?.errorMargin || null,
      next_game: nextGame,
      odds_source: odds?.source || 'unknown',
      odds_bookmaker: odds?.bookmaker || null,
      player_image: stats?.player?.nba_id 
        ? `https://cdn.nba.com/headshots/nba/latest/260x190/${stats.player.nba_id}.png` 
        : (stats?.player?.id 
          ? `https://cdn.nba.com/headshots/nba/latest/260x190/${stats.player.id}.png` 
          : null)
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

