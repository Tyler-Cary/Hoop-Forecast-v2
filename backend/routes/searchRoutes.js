import express from 'express';
import { searchPlayer, getActivePlayers } from '../services/balldontlieService.js';

const router = express.Router();

/**
 * GET /api/search?q=playerName
 * Search for players by name
 */
router.get('/', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter "q" is required' });
    }

    console.log(`🔍 Search request for: "${query}"`);
    const players = await searchPlayer(query);
    console.log(`✅ Returning ${players.length} players`);
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

/**
 * GET /api/search/active
 * Get list of active players
 */
router.get('/active', async (req, res) => {
  try {
    const players = await getActivePlayers();
    res.json(players);
  } catch (error) {
    console.error('Error fetching active players:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch active players' });
  }
});

export { router as searchRoutes };

