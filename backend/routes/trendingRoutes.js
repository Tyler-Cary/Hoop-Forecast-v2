import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import NodeCache from 'node-cache';
import {
  getPropBookCount,
  findBestOdds,
  getPropSportsbooks,
  sortByBookCount
} from '../utils/trendingHelpers.js';

dotenv.config();

const router = express.Router();

const THE_ODDS_API_KEY = process.env.THE_ODDS_API_KEY || process.env.ODDS_API_KEY;
const THE_ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

// Cache trending props for 5 minutes
const trendingCache = new NodeCache({ stdTTL: 300 });

/**
 * GET /api/trending/props
 * Get trending props based on sportsbook count (most market activity)
 */
router.get('/props', async (req, res) => {
  try {
    if (!THE_ODDS_API_KEY) {
      console.log('⚠️ No Odds API key configured');
      return res.json([]);
    }

    // Check cache first
    const cached = trendingCache.get('trending_props');
    if (cached) {
      console.log('✅ Using cached trending props');
      return res.json(cached);
    }

    console.log('📊 Calculating trending props from Odds API...');

    // Step 1: Get all NBA events
    const eventsResponse = await axios.get(`${THE_ODDS_API_BASE}/sports/basketball_nba/events`, {
      params: { apiKey: THE_ODDS_API_KEY },
      timeout: 15000
    });

    if (!eventsResponse.data || !Array.isArray(eventsResponse.data)) {
      return res.json([]);
    }

    const events = eventsResponse.data.slice(0, 10); // Limit to first 10 events
    console.log(`📋 Found ${events.length} events for trending analysis`);

    const trendingPropsMap = new Map(); // Key: "playerName|propType|line"

    // Step 2: For each event, get all player props
    for (const event of events) {
      try {
        const oddsResponse = await axios.get(
          `${THE_ODDS_API_BASE}/sports/basketball_nba/events/${event.id}/odds`,
          {
            params: {
              apiKey: THE_ODDS_API_KEY,
              regions: 'us',
              markets: 'player_points,player_rebounds,player_assists,player_threes,player_points_rebounds_assists,player_points_rebounds,player_points_assists,player_rebounds_assists',
              oddsFormat: 'american'
            },
            timeout: 10000
          }
        );

        if (!oddsResponse.data || !oddsResponse.data.bookmakers) {
          continue;
        }

        console.log(`📊 Event ${event.id}: Analyzing ${oddsResponse.data.bookmakers.length} bookmakers`);

        // Step 3: Extract all player props and count sportsbooks per line
        for (const bookmaker of oddsResponse.data.bookmakers) {
          const sportsbookName = bookmaker.title || bookmaker.key;

          for (const market of bookmaker.markets || []) {
            const propTypeKey = market.key;
            let propType = propTypeKey.replace('player_', '');
            
            // Map prop types
            const propTypeMap = {
              'points': 'points',
              'rebounds': 'rebounds',
              'assists': 'assists',
              'threes': 'threes',
              'points_rebounds_assists': 'pra',
              'points_rebounds': 'pr',
              'points_assists': 'pa',
              'rebounds_assists': 'ra'
            };
            propType = propTypeMap[propType] || propType;

            for (const outcome of market.outcomes || []) {
              const playerName = outcome.description;
              const line = parseFloat(outcome.point);
              const odds = outcome.price;

              if (!playerName || isNaN(line) || line <= 0) continue;

              // Create unique key for this player/prop/line combination
              const key = `${playerName.toLowerCase()}|${propType}|${line}`;

              if (!trendingPropsMap.has(key)) {
                trendingPropsMap.set(key, {
                  player: playerName,
                  propType: propType,
                  line: line,
                  event_id: event.id,
                  home_team: event.home_team,
                  away_team: event.away_team,
                  sportsbooks: new Map() // Map of sportsbook → { over, under }
                });
              }

              const propData = trendingPropsMap.get(key);
              
              // Initialize sportsbook entry if needed
              if (!propData.sportsbooks.has(sportsbookName)) {
                propData.sportsbooks.set(sportsbookName, {});
              }

              const bookData = propData.sportsbooks.get(sportsbookName);
              
              // Store over/under odds
              if (outcome.name === 'Over') {
                bookData.over = { line, odds };
              } else if (outcome.name === 'Under') {
                bookData.under = { line, odds };
              }
            }
          }
        }
      } catch (err) {
        console.log(`⚠️ Error processing event ${event.id}:`, err.message);
        continue;
      }
    }

    console.log(`📊 Analyzed ${trendingPropsMap.size} unique player/prop/line combinations`);

    // Step 4: Convert to array and calculate metrics
    const trendingPropsArray = [];

    for (const [key, propData] of trendingPropsMap.entries()) {
      const bookCount = propData.sportsbooks.size;
      
      // Only include props with at least 3 sportsbooks
      if (bookCount < 3) continue;

      // Convert sportsbooks Map to plain object for helper functions
      const sportsbooksObj = {};
      for (const [book, data] of propData.sportsbooks.entries()) {
        sportsbooksObj[book] = data;
      }

      const bestOdds = findBestOdds(sportsbooksObj);
      const booksList = Array.from(propData.sportsbooks.keys());

      trendingPropsArray.push({
        player: propData.player,
        prop_type: propData.propType,
        line: propData.line,
        bookCount: bookCount,
        books: booksList,
        bestOdds: bestOdds,
        home_team: propData.home_team,
        away_team: propData.away_team,
        event_id: propData.event_id
      });
    }

    // Step 5: Sort by book count and take top 15
    const sortedProps = sortByBookCount(trendingPropsArray).slice(0, 15);

    console.log(`✅ Returning top ${sortedProps.length} trending props`);

    // Step 6: Add player images
    console.log('🖼️ Fetching player images for trending props...');
    const { getImageUrl, imageExists } = await import('../services/imageStorageService.js');
    
    for (const prop of sortedProps) {
      try {
        // Check if image exists locally
        if (imageExists(prop.player)) {
          prop.player_image = getImageUrl(prop.player);
        } else {
          prop.player_image = null; // Will show initials on frontend
        }
      } catch (error) {
        prop.player_image = null;
      }
    }

    const propsWithImages = sortedProps.filter(p => p.player_image).length;
    console.log(`✅ Found images for ${propsWithImages}/${sortedProps.length} trending props`);

    // Cache the result
    trendingCache.set('trending_props', sortedProps);

    res.json(sortedProps);

  } catch (error) {
    console.error('❌ Error fetching trending props:', error.message);
    res.status(500).json({ error: 'Failed to fetch trending props' });
  }
});

export { router as trendingRoutes };

