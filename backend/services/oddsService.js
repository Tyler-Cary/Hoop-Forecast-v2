import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Use SportsGameOdds API
// Force use of SportsGameOdds API key (not The Odds API key)
const SPORTSGAMEODDS_API_KEY = 'f0e12e3bb34a1197adf864e68ba023e7';
const ODDS_API_KEY = SPORTSGAMEODDS_API_KEY; // Always use SportsGameOdds key
const ODDS_API_BASE = 'https://api.sportsgameodds.com/v2';

/**
 * Fetch player points prop line from SportsGameOdds API
 */
export async function getPlayerOdds(playerId, playerName) {
  if (!ODDS_API_KEY) {
    throw new Error('ODDS_API_KEY not configured');
  }

  try {
    console.log(`🎲 Fetching odds from SportsGameOdds for player: ${playerName || playerId}`);
    console.log(`🔑 API Key: ${ODDS_API_KEY.substring(0, 8)}...`);
    
    // Preferred bookmakers (in order of preference)
    const preferredBookmakers = [
      'draftkings', 'fanduel', 'betmgm', 'caesars', 'pointsbet', 
      'barstool', 'betrivers', 'wynnbet', 'unibet', 'foxbet'
    ];
    
    // SportsGameOdds API - use X-API-Key header for authentication
    // Try different endpoints for player props
    const attempts = [
      // Main events endpoint with NBA filter (v2)
      {
        url: `${ODDS_API_BASE}/events`,
        params: {
          oddsAvailable: 'true',
          leagueID: 'NBA'
        }
      },
      // Try with different parameter names
      {
        url: `${ODDS_API_BASE}/events`,
        params: {
          league: 'NBA',
          sport: 'basketball'
        }
      },
      // Try v1 endpoints
      {
        url: 'https://api.sportsgameodds.com/v1/events',
        params: {
          leagueID: 'NBA'
        }
      },
      // Try odds endpoint (v1)
      {
        url: 'https://api.sportsgameodds.com/v1/odds',
        params: {
          leagueID: 'NBA'
        }
      },
      // Try player props endpoint (v1)
      {
        url: 'https://api.sportsgameodds.com/v1/player-props',
        params: {
          leagueID: 'NBA',
          player: playerName
        }
      },
      // Try with different base URL format
      {
        url: 'https://api.sportsgameodds.com/v2/events/',
        params: {
          leagueID: 'NBA',
          oddsAvailable: true
        }
      }
    ];
    
    for (const attempt of attempts) {
      try {
        console.log(`  🔄 Trying: ${attempt.url}`);
        console.log(`  📋 Params:`, attempt.params);
        
        const response = await axios.get(attempt.url, {
          params: attempt.params,
          timeout: 20000,
          headers: {
            'Accept': 'application/json',
            'X-API-Key': ODDS_API_KEY // SportsGameOdds uses header authentication
          }
        });
        
        console.log(`  📥 Response status: ${response.status}`);
        console.log(`  📊 Response type: ${Array.isArray(response.data) ? 'array' : typeof response.data}`);
        
        if (response.data) {
          const data = response.data;
          
          // Log full response structure for debugging
          console.log(`  📋 Full response:`, JSON.stringify(data, null, 2).substring(0, 2000));
          
          // Try to parse the response
          const playerLine = parseSportsGameOddsResponse(data, playerName, preferredBookmakers);
          if (playerLine) {
            return playerLine;
          }
        }
      } catch (apiError) {
        console.log(`  ⚠️ Attempt failed:`, apiError.message);
        if (apiError.response) {
          console.log(`  📥 Error status: ${apiError.response.status}`);
          console.log(`  📥 Error data:`, JSON.stringify(apiError.response.data).substring(0, 500));
        }
        continue;
      }
    }
    
    // If all attempts failed, throw error
    throw new Error('No player props found. Check API response structure in logs above.');
  } catch (error) {
    console.error('❌ Error fetching odds:', error.message);
    if (error.response) {
      console.error('Error status:', error.response.status);
      console.error('Error data:', error.response.data);
    }
    
    throw new Error(`Failed to fetch odds from SportsGameOdds API: ${error.response?.data?.message || error.message}`);
  }
}

/**
 * Parse SportsGameOdds API response to find player line
 * Prioritizes major sportsbooks like DraftKings, FanDuel, etc.
 * 
 * Response structure:
 * Array of events, each with:
 * - odds: object with keys like "points-PLAYER_ID-game-ou-over"
 * - players: object with player info
 */
function parseSportsGameOddsResponse(data, playerName, preferredBookmakers = []) {
  if (!data || !playerName) {
    return null;
  }
  
  const searchName = playerName.toLowerCase().trim();
  const nameParts = searchName.split(' ').filter(p => p.length > 0);
  
  console.log(`🔍 Parsing SportsGameOdds response for: "${playerName}"`);
  
  // Handle response structure - should be an array of events
  let events = [];
  
  if (Array.isArray(data)) {
    events = data;
  } else if (data.data && Array.isArray(data.data)) {
    events = data.data;
  } else if (data.events && Array.isArray(data.events)) {
    events = data.events;
  }
  
  console.log(`📊 Found ${events.length} events to check`);
  
  const foundLines = [];
  
  // Search through events
  for (const event of events) {
    // Check if event has odds object
    if (!event.odds || typeof event.odds !== 'object') {
      continue;
    }
    
    // Look for points props in the odds object
    // Keys are like: "points-PLAYER_ID-game-ou-over" or "points-PLAYER_ID-game-ou-under"
    const oddsKeys = Object.keys(event.odds);
    
    for (const oddKey of oddsKeys) {
      // Check if this is a points prop (starts with "points-")
      if (!oddKey.startsWith('points-') || !oddKey.includes('-game-ou-')) {
        continue;
      }
      
      const odd = event.odds[oddKey];
      
      // Get player info from the odd or from event.players
      let playerInfo = null;
      if (odd.playerID && event.players && event.players[odd.playerID]) {
        playerInfo = event.players[odd.playerID];
      }
      
      // Try to match player name
      const marketName = (odd.marketName || '').toLowerCase();
      const oddPlayerName = playerInfo 
        ? `${playerInfo.firstName || ''} ${playerInfo.lastName || ''}`.toLowerCase().trim()
        : '';
      
      // Check if this matches our player
      let matches = false;
      if (nameParts.length >= 2) {
        const firstNameMatch = marketName.includes(nameParts[0]) || oddPlayerName.includes(nameParts[0]);
        const lastNameMatch = marketName.includes(nameParts[nameParts.length - 1]) || oddPlayerName.includes(nameParts[nameParts.length - 1]);
        matches = firstNameMatch && lastNameMatch;
      } else if (nameParts.length === 1) {
        matches = marketName.includes(nameParts[0]) || oddPlayerName.includes(nameParts[0]);
      }
      
      if (matches && odd.bookOverUnder != null) {
        // This is a points prop for our player!
        const line = parseFloat(odd.bookOverUnder);
        
        // Get bookmaker info from byBookmaker object
        // We need to get both over and under odds from the same bookmaker
        let bookmaker = 'Unknown';
        let overOdds = -110;
        let underOdds = -110;
        
        // Get the opposing odd to get both sides
        const opposingOdd = odd.opposingOddID ? event.odds[odd.opposingOddID] : null;
        
        // Find preferred bookmaker that has both over and under
        for (const prefBook of preferredBookmakers) {
          // Check if this bookmaker has the current odd
          const currentBookKey = odd.byBookmaker ? Object.keys(odd.byBookmaker).find(k => k.toLowerCase().includes(prefBook)) : null;
          const opposingBookKey = opposingOdd && opposingOdd.byBookmaker ? Object.keys(opposingOdd.byBookmaker).find(k => k.toLowerCase().includes(prefBook)) : null;
          
          if (currentBookKey || opposingBookKey) {
            bookmaker = (currentBookKey || opposingBookKey).charAt(0).toUpperCase() + (currentBookKey || opposingBookKey).slice(1);
            
            // Get over odds
            if (oddKey.endsWith('-over') && currentBookKey) {
              const bookData = odd.byBookmaker[currentBookKey];
              if (bookData.odds) overOdds = parseFloat(bookData.odds);
            } else if (opposingOdd && opposingOdd.byBookmaker && opposingBookKey) {
              const bookData = opposingOdd.byBookmaker[opposingBookKey];
              if (bookData.odds && odd.opposingOddID.endsWith('-over')) {
                overOdds = parseFloat(bookData.odds);
              }
            }
            
            // Get under odds
            if (oddKey.endsWith('-under') && currentBookKey) {
              const bookData = odd.byBookmaker[currentBookKey];
              if (bookData.odds) underOdds = parseFloat(bookData.odds);
            } else if (opposingOdd && opposingOdd.byBookmaker && opposingBookKey) {
              const bookData = opposingOdd.byBookmaker[opposingBookKey];
              if (bookData.odds && odd.opposingOddID.endsWith('-under')) {
                underOdds = parseFloat(bookData.odds);
              }
            }
            
            break;
          }
        }
        
        // If no preferred bookmaker found, use first available
        if (bookmaker === 'Unknown' && odd.byBookmaker) {
          const firstBook = Object.keys(odd.byBookmaker)[0];
          if (firstBook) {
            const bookData = odd.byBookmaker[firstBook];
            bookmaker = firstBook.charAt(0).toUpperCase() + firstBook.slice(1);
            if (bookData.odds) {
              const oddsNum = parseFloat(bookData.odds);
              if (oddKey.endsWith('-over')) {
                overOdds = oddsNum;
              } else if (oddKey.endsWith('-under')) {
                underOdds = oddsNum;
              }
            }
            
            // Try to get the other side from opposing odd
            if (opposingOdd && opposingOdd.byBookmaker && opposingOdd.byBookmaker[firstBook]) {
              const opposingBookData = opposingOdd.byBookmaker[firstBook];
              if (opposingBookData.odds) {
                const oddsNum = parseFloat(opposingBookData.odds);
                if (odd.opposingOddID.endsWith('-over')) {
                  overOdds = oddsNum;
                } else if (odd.opposingOddID.endsWith('-under')) {
                  underOdds = oddsNum;
                }
              }
            }
          }
        }
        
        foundLines.push({
          line: line,
          over_odds: overOdds,
          under_odds: underOdds,
          bookmaker: bookmaker,
          priority: preferredBookmakers.findIndex(p => bookmaker.toLowerCase().includes(p)),
          last_update: odd.lastUpdatedAt || new Date().toISOString()
        });
        
        console.log(`  ✅ Found points line: ${line} from ${bookmaker} (${oddKey})`);
      }
    }
  }
  
  // If we found lines, return the best one
  if (foundLines.length > 0) {
    foundLines.sort((a, b) => {
      if (a.priority !== b.priority) {
        if (a.priority === -1) return 1;
        if (b.priority === -1) return -1;
        return a.priority - b.priority;
      }
      return 0;
    });
    
    const bestLine = foundLines[0];
    console.log(`✅✅✅ Using best line: ${bestLine.line} from ${bestLine.bookmaker} (found ${foundLines.length} total)`);
    
    return {
      player: playerName,
      line: bestLine.line,
      over_odds: bestLine.over_odds,
      under_odds: bestLine.under_odds,
      bookmaker: bestLine.bookmaker,
      last_update: bestLine.last_update,
      source: 'sportsgameodds',
      all_lines: foundLines.map(l => ({ bookmaker: l.bookmaker, line: l.line }))
    };
  }
  
  console.log(`❌ No points line found for ${playerName}`);
  return null;
}

/**
 * Legacy function name for backwards compatibility
 */
function parseOddsResponse(oddsData, playerName, preferredBookmakers = []) {
  if (!Array.isArray(oddsData) || !playerName) {
    return null;
  }
  
  const searchName = playerName.toLowerCase().trim();
  const nameParts = searchName.split(' ').filter(p => p.length > 0);
  
  console.log(`🔍 Searching for player: "${playerName}" (search: "${searchName}")`);
  console.log(`📊 Checking ${oddsData.length} games for player props...`);
  
  // Log full structure of first game for debugging
  if (oddsData.length > 0) {
    console.log('📋 Full game structure:', JSON.stringify(oddsData[0], null, 2).substring(0, 2000));
  }
  
  // Store all found lines to prioritize by bookmaker
  const foundLines = [];
  
  // Iterate through games
  for (const game of oddsData) {
    // Check if game has bookmakers
    const bookmakers = game.bookmakers || game.sites || [];
    if (!Array.isArray(bookmakers) || bookmakers.length === 0) {
      console.log(`  ⚠️ Game has no bookmakers`);
      continue;
    }
    
    console.log(`  📚 Checking ${bookmakers.length} bookmakers in game...`);
    
    // Sort bookmakers by preference (preferred ones first)
    const sortedBookmakers = [...bookmakers].sort((a, b) => {
      const aName = (a.title || a.key || a.site_nice || '').toLowerCase();
      const bName = (b.title || b.key || b.site_nice || '').toLowerCase();
      
      const aIndex = preferredBookmakers.findIndex(p => aName.includes(p));
      const bIndex = preferredBookmakers.findIndex(p => bName.includes(p));
      
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
    
    // Check each bookmaker (preferred ones first)
    for (const bookmaker of sortedBookmakers) {
      const bookmakerName = (bookmaker.title || bookmaker.key || bookmaker.site_nice || 'Unknown').toLowerCase();
      console.log(`    🏪 Checking ${bookmaker.title || bookmaker.key || bookmaker.site_nice || 'bookmaker'}...`);
      
      const markets = bookmaker.markets || bookmaker.odds || [];
      if (!Array.isArray(markets) || markets.length === 0) {
        continue;
      }
      
      console.log(`      📈 Found ${markets.length} markets`);
      
      // Look through all markets for player props
      for (const market of markets) {
        const marketKey = (market.key || market.name || '').toLowerCase();
        
        // Check if this is a player points market - be more flexible
        const isPlayerPointsMarket = 
          (marketKey.includes('player') && (marketKey.includes('point') || marketKey.includes('pts'))) ||
          marketKey === 'player_points' ||
          marketKey === 'player_points_over_under';
        
        if (isPlayerPointsMarket) {
          console.log(`      ✅ Found player points market: ${market.key || market.name}`);
          
          // Outcomes can be in different formats
          const outcomes = market.outcomes || market.results || [];
          if (!Array.isArray(outcomes) || outcomes.length === 0) {
            console.log(`      ⚠️ Market has no outcomes`);
            continue;
          }
          
          console.log(`      📊 Checking ${outcomes.length} outcomes...`);
          
          // Search for player by name in outcomes
          for (const outcome of outcomes) {
            // Try multiple field names for player name
            const outcomeName = (
              outcome.name || 
              outcome.description || 
              outcome.label || 
              outcome.title ||
              outcome.player ||
              outcome.participant ||
              ''
            ).toLowerCase();
            
            // Try multiple field names for the point line
            const outcomePoint = 
              outcome.point || 
              outcome.line || 
              outcome.total || 
              outcome.over?.point || 
              outcome.under?.point ||
              outcome.price?.point ||
              null;
            
            // Better matching: check if both first and last name appear
            if (nameParts.length >= 2) {
              const firstNameMatch = outcomeName.includes(nameParts[0]);
              const lastNameMatch = outcomeName.includes(nameParts[nameParts.length - 1]);
              
              if (firstNameMatch && lastNameMatch && outcomePoint != null) {
                // Found the player!
                const playerLine = {
                  line: parseFloat(outcomePoint),
                  over_odds: outcome.over?.price || outcome.price || -110,
                  under_odds: outcome.under?.price || outcome.price || -110,
                  bookmaker: bookmaker.title || bookmaker.key || bookmaker.site_nice || 'Unknown',
                  last_update: new Date().toISOString()
                };
                
                foundLines.push({
                  ...playerLine,
                  priority: preferredBookmakers.findIndex(p => bookmakerName.includes(p))
                });
                
                console.log(`      ✅ Found line: ${playerLine.line} from ${playerLine.bookmaker}`);
              }
            } else if (nameParts.length === 1 && outcomeName.includes(nameParts[0]) && outcomePoint != null) {
              // Single name match
              const playerLine = {
                line: parseFloat(outcomePoint),
                over_odds: outcome.over?.price || outcome.price || -110,
                under_odds: outcome.under?.price || outcome.price || -110,
                bookmaker: bookmaker.title || bookmaker.key || bookmaker.site_nice || 'Unknown',
                last_update: new Date().toISOString()
              };
              
              foundLines.push({
                ...playerLine,
                priority: preferredBookmakers.findIndex(p => bookmakerName.includes(p))
              });
              
              console.log(`      ✅ Found line: ${playerLine.line} from ${playerLine.bookmaker}`);
            }
          }
        }
      }
    }
  }
  
  // If we found multiple lines, prioritize preferred bookmakers
  if (foundLines.length > 0) {
    // Sort by priority (lower index = higher priority), then by bookmaker name
    foundLines.sort((a, b) => {
      if (a.priority !== b.priority) {
        // Prefer lines from preferred bookmakers (lower index = better)
        if (a.priority === -1) return 1;
        if (b.priority === -1) return -1;
        return a.priority - b.priority;
      }
      return 0;
    });
    
    const bestLine = foundLines[0];
    console.log(`✅✅✅ Using best line: ${bestLine.line} from ${bestLine.bookmaker} (found ${foundLines.length} total lines)`);
    
    return {
      player: playerName,
      line: bestLine.line,
      over_odds: bestLine.over_odds,
      under_odds: bestLine.under_odds,
      bookmaker: bestLine.bookmaker,
      last_update: bestLine.last_update,
      source: 'theoddsapi',
      all_lines: foundLines.map(l => ({ bookmaker: l.bookmaker, line: l.line })) // Show all found lines
    };
  }
  
  console.log(`❌ Player line not found in API response after checking all games`);
  return null;
}

