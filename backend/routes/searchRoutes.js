import express from 'express';
import { searchPlayersESPN } from '../services/nbaApiService.js';

const router = express.Router();

/**
 * GET /api/search?q=playerName
 * Search for players by name using ESPN API
 */
router.get('/', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    console.log(`🔍 Search request for: "${query}"`);
    const players = await searchPlayersESPN(query);
    console.log(`✅ Returning ${players.length} players from ESPN`);
    res.json(players);
  } catch (error) {
    console.error('❌ Error in search route:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: error.message || 'Failed to search players',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

export { router as searchRoutes };

