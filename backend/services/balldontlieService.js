import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// balldontlie API endpoints - try both
const BALLDONTLIE_API = 'https://api.balldontlie.io/v1';
const BALLDONTLIE_API_ALT = 'https://www.balldontlie.io/api/v1';
const BALLDONTLIE_API_KEY = process.env.BALLDONTLIE_API_KEY;

// Configure axios client with API key authentication
// According to docs, use Authorization header with just the API key
const balldontlieClient = axios.create({
  baseURL: BALLDONTLIE_API,
  timeout: 15000
});

// Add interceptor to include API key in headers for every request
if (BALLDONTLIE_API_KEY) {
  balldontlieClient.interceptors.request.use(config => {
    config.headers = config.headers || {};
    config.headers['Authorization'] = BALLDONTLIE_API_KEY;
    console.log('📤 Request URL:', config.url);
    console.log('📤 Request headers:', { Authorization: BALLDONTLIE_API_KEY ? 'present' : 'missing' });
    return config;
  });
  
  balldontlieClient.interceptors.response.use(
    response => {
      console.log('📥 Response status:', response.status);
      return response;
    },
    error => {
      console.error('📥 Response error:', error.message);
      return Promise.reject(error);
    }
  );
} else {
  console.warn('⚠️ BALLDONTLIE_API_KEY not found in environment variables');
}

/**
 * Search for a player by name
 */
export async function searchPlayer(playerName) {
  try {
    console.log(`🔍 Searching for player: "${playerName}" with API key: ${BALLDONTLIE_API_KEY ? 'present' : 'missing'}`);
    
    const response = await balldontlieClient.get('/players', {
      params: {
        search: playerName,
        per_page: 25
      }
    });
    
    console.log('API Response status:', response.status);
    console.log('API Response data structure:', {
      hasData: !!response.data,
      hasDataArray: !!response.data?.data,
      isArray: Array.isArray(response.data),
      dataLength: response.data?.data?.length || response.data?.length || 0
    });
    
    // Handle the actual API response structure
    if (response.data?.data && Array.isArray(response.data.data) && response.data.data.length > 0) {
      console.log(`✅ Found ${response.data.data.length} players from API`);
      return response.data.data;
    }
    
    // If response is directly an array
    if (Array.isArray(response.data) && response.data.length > 0) {
      console.log(`✅ Found ${response.data.length} players from API (direct array)`);
      return response.data;
    }
    
    // If no results found, return empty array (don't use mock data)
    console.log('⚠️ API returned no results for this search');
    return [];
    
  } catch (error) {
    console.error('❌ Error searching player:', error.message);
    console.error('Error code:', error.code);
    console.error('Response status:', error.response?.status);
    
    // Handle rate limiting specifically
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'] || error.response.headers['Retry-After'];
      const rateLimitReset = error.response.headers['x-ratelimit-reset'];
      const rateLimitRemaining = error.response.headers['x-ratelimit-remaining'];
      const rateLimitLimit = error.response.headers['x-ratelimit-limit'];
      
      console.error('⏱️ Rate limit exceeded!');
      console.error(`Rate limit: ${rateLimitRemaining}/${rateLimitLimit} remaining`);
      console.error(`Retry after: ${retryAfter} seconds`);
      
      throw new Error(`Rate limit exceeded. The API allows ${rateLimitLimit} requests. Please wait ${retryAfter || 60} seconds before trying again.`);
    }
    
    console.error('Response status text:', error.response?.statusText);
    console.error('Response data:', JSON.stringify(error.response?.data, null, 2));
    
    // Provide more detailed error message
    if (error.response) {
      // Server responded with error
      throw new Error(`API Error (${error.response.status}): ${error.response.data?.message || error.response.statusText || error.message}`);
    } else if (error.request) {
      // Request made but no response
      throw new Error(`No response from API: ${error.message}`);
    } else {
      // Error setting up request
      throw new Error(`Request setup error: ${error.message}`);
    }
  }
}

/**
 * Get player's last 10 games stats
 */
// Generate mock game stats for testing when API is unavailable
function generateMockStats(playerName, numGames = 10) {
  // Set base points based on player name
  let basePoints = 25; // Default
  if (playerName.includes('Curry')) basePoints = 28;
  else if (playerName.includes('James') || playerName.includes('LeBron')) basePoints = 27;
  else if (playerName.includes('Durant')) basePoints = 29;
  else if (playerName.includes('Jokic') || playerName.includes('Nikola')) basePoints = 26;
  else if (playerName.includes('Tatum')) basePoints = 27;
  else if (playerName.includes('Embiid')) basePoints = 30;
  else if (playerName.includes('Booker')) basePoints = 27;
  else if (playerName.includes('Edwards')) basePoints = 26;
  else if (playerName.includes('Leonard') || playerName.includes('Kawhi')) basePoints = 24;
  else if (playerName.includes('Butler')) basePoints = 22;
  else if (playerName.includes('Doncic') || playerName.includes('Luka')) basePoints = 33;
  else if (playerName.includes('Antetokounmpo') || playerName.includes('Giannis')) basePoints = 31;
  
  const games = [];
  const today = new Date();
  
  for (let i = 0; i < numGames; i++) {
    const gameDate = new Date(today);
    gameDate.setDate(gameDate.getDate() - (i * 2)); // Games every 2 days
    
    // Add some variance to points (more realistic)
    const variance = Math.floor(Math.random() * 15) - 7; // -7 to +7
    const points = Math.max(10, basePoints + variance);
    
    games.push({
      game_number: numGames - i,
      date: gameDate.toISOString().split('T')[0],
      points: points, // Ensure it's a number
      minutes: `${Math.floor(Math.random() * 10) + 30}`,
      opponent: ['LAL', 'BOS', 'MIA', 'PHX', 'MIL', 'DEN', 'PHI', 'DAL', 'GSW', 'LAC'][Math.floor(Math.random() * 10)],
      home: Math.random() > 0.5
    });
  }
  
  return games;
}

export async function getPlayerStats(playerId) {
  try {
    console.log(`📊 Fetching stats for player ID: ${playerId} with API key: ${BALLDONTLIE_API_KEY ? 'present' : 'missing'}`);
    
    // First, get player info
    const playerResponse = await balldontlieClient.get(`/players/${playerId}`);
    const player = playerResponse.data?.data || playerResponse.data;
    
    if (!player) {
      throw new Error('Player not found');
    }
    
    console.log(`✅ Found player: ${player.first_name} ${player.last_name}`);
    
    // Try NBA.com API first (official, most reliable)
    // Note: balldontlie player IDs are different from NBA.com player IDs
    // So we need to search NBA.com by player name to get the correct ID
    try {
      const { searchPlayer, getPlayerGameLog } = await import('./nbaApiService.js');
      const playerName = `${player.first_name} ${player.last_name}`;
      
      console.log(`🔍 Searching NBA.com for: ${playerName}`);
      const nbaPlayer = await searchPlayer(playerName);
      
      if (nbaPlayer && nbaPlayer.id) {
        console.log(`✅ Found NBA.com player ID: ${nbaPlayer.id} for ${nbaPlayer.name}`);
        const nbaGames = await getPlayerGameLog(nbaPlayer.id);
        
        if (nbaGames && nbaGames.length > 0) {
          console.log(`✅ Got ${nbaGames.length} games from NBA.com API`);
          return {
            player: {
              id: player.id,
              nba_id: nbaPlayer.id, // Store NBA.com ID for image URL
              first_name: player.first_name,
              last_name: player.last_name,
              position: player.position,
              team: nbaPlayer.team || player.team?.abbreviation || 'N/A'
            },
            games: nbaGames
          };
        }
      } else {
        console.log(`⚠️ Could not find player on NBA.com: ${playerName}`);
      }
    } catch (nbaError) {
      console.log('⚠️ NBA.com API failed, falling back to balldontlie API:', nbaError.message);
      // Fall through to use balldontlie API
    }

    // Get stats - fetch most recent games from current season
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-12
    // NBA season typically runs from October to June
    // If we're before October, use previous year's season
    const seasonYear = currentMonth >= 10 ? currentYear : currentYear - 1;
    
    console.log(`📅 Current date: ${currentYear}-${currentMonth}, Using season: ${seasonYear}`);
    
    let stats = [];
    
    // Try multiple approaches to get current season games
    // Fetch more games (50) so we can filter to get the most recent 10
    const attempts = [
      // Try 1: Current season with array format
      {
        params: {
          player_ids: playerId,
          per_page: 50, // Get more games to filter from
          seasons: [seasonYear]
        },
        name: 'current season (array)'
      },
      // Try 2: Current and previous season
      {
        params: {
          player_ids: playerId,
          per_page: 50,
          seasons: [seasonYear, seasonYear - 1]
        },
        name: 'current + previous season'
      },
      // Try 3: Just get most recent games (no season filter) - fetch more to find recent ones
      {
        params: {
          player_ids: playerId,
          per_page: 50
        },
        name: 'most recent (no season filter)'
      }
    ];
    
    for (const attempt of attempts) {
      try {
        console.log(`📈 Attempting to fetch stats: ${attempt.name}...`);
        const statsResponse = await balldontlieClient.get('/stats', { params: attempt.params });
        
        console.log('Stats response status:', statsResponse.status);
        
        if (statsResponse.data?.data && Array.isArray(statsResponse.data.data) && statsResponse.data.data.length > 0) {
          stats = statsResponse.data.data;
          
          // Check if we got recent games (from current or previous season)
          const firstGameDate = stats[0]?.game?.date || stats[0]?.date;
          if (firstGameDate) {
            const gameYear = new Date(firstGameDate).getFullYear();
            const isRecent = gameYear >= seasonYear - 1; // Current or previous season
            
            console.log(`✅ Found ${stats.length} games from API`);
            console.log(`📅 First game date: ${firstGameDate} (year: ${gameYear}, recent: ${isRecent})`);
            
            if (isRecent) {
              console.log(`✅ Games are from recent season, using this data`);
              break; // Use this data
            } else {
              console.log(`⚠️ Games are from old season (${gameYear}), trying next method...`);
              stats = []; // Clear and try next method
            }
          } else {
            console.log(`✅ Found ${stats.length} games (no date info), using this data`);
            break; // Use this data
          }
        }
      } catch (statsError) {
        console.error(`❌ Error with ${attempt.name}:`, statsError.message);
        continue; // Try next method
      }
    }
    
    // If still no stats, try alternative format
    if (stats.length === 0) {
      try {
        console.log('🔄 Trying alternative format (player_ids[])...');
        const altResponse = await balldontlieClient.get('/stats', {
          params: {
            'player_ids[]': playerId,
            per_page: 10
          }
        });
        
        if (altResponse.data?.data && Array.isArray(altResponse.data.data) && altResponse.data.data.length > 0) {
          stats = altResponse.data.data;
          console.log(`✅ Found ${stats.length} games with alternative format`);
        }
      } catch (altError) {
        console.error('❌ Alternative format also failed:', altError.message);
      }
    }
    
    if (stats.length === 0) {
      throw new Error(`No game stats found for player ${playerId} in recent seasons.`);
    }
    
    // Format games data from API response
    if (stats.length > 0) {
      // Filter to only include games from recent seasons
      // NBA season runs Oct-June, so get games from last 2 seasons
      const currentDate = new Date();
      const twoYearsAgo = new Date(currentDate);
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
      
      const recentStats = stats.filter(stat => {
        const gameDate = stat.game?.date || stat.date;
        if (!gameDate) return false; // Exclude if no date
        const gameDateObj = new Date(gameDate);
        
        // Include games from the last 2 years (covers current and previous season)
        const isRecent = gameDateObj >= twoYearsAgo;
        
        if (!isRecent) {
          console.log(`⏭️ Skipping old game: ${gameDate} (${gameDateObj.getFullYear()})`);
        }
        
        return isRecent;
      });
      
      console.log(`📊 Filtered ${stats.length} total games to ${recentStats.length} recent games`);
      
      if (recentStats.length === 0) {
        throw new Error(`No recent game stats found for player ${playerId}. All games are from old seasons.`);
      }
      
      // Sort by date (most recent first) - ensure we get the latest games
      const sortedStats = [...recentStats].sort((a, b) => {
        const dateA = new Date(a.game?.date || a.date || 0);
        const dateB = new Date(b.game?.date || b.date || 0);
        return dateB - dateA; // Most recent first
      });
      
      // Take only the most recent 10 games
      const latest10Games = sortedStats.slice(0, 10);
      
      console.log(`📅 First (most recent) game date: ${latest10Games[0]?.game?.date || latest10Games[0]?.date}`);
      console.log(`📅 Last (oldest) game date: ${latest10Games[latest10Games.length - 1]?.game?.date || latest10Games[latest10Games.length - 1]?.date}`);
      console.log(`📊 Using ${latest10Games.length} most recent games`);
      
      const games = latest10Games.map((stat, index) => {
        // Determine opponent - the team that's NOT the player's team
        const playerTeamId = stat.team?.id;
        const homeTeamId = stat.game?.home_team?.id;
        const visitorTeamId = stat.game?.visitor_team?.id;
        let opponent = 'N/A';
        
        // Try to get opponent from game data
        if (stat.game) {
          if (homeTeamId && visitorTeamId && playerTeamId) {
            // Player's team is either home or visitor
            if (playerTeamId === homeTeamId) {
              opponent = stat.game.visitor_team?.abbreviation || stat.game.visitor_team?.name || 'N/A';
            } else if (playerTeamId === visitorTeamId) {
              opponent = stat.game.home_team?.abbreviation || stat.game.home_team?.name || 'N/A';
            }
          }
          
          // Fallback: try to get any team abbreviation
          if (!opponent || opponent === 'N/A') {
            opponent = stat.game.visitor_team?.abbreviation || 
                       stat.game.home_team?.abbreviation ||
                       stat.game.visitor_team?.name ||
                       stat.game.home_team?.name ||
                       'N/A';
          }
        }
        
        const points = typeof stat.pts === 'number' ? stat.pts : parseFloat(stat.pts) || 0;
        const gameDate = stat.game?.date || stat.date || 'Unknown';
        console.log(`Game ${index + 1}: ${points} pts vs ${opponent} on ${gameDate}`);
        
        return {
          game_number: index + 1, // Game 1 = most recent, Game 10 = oldest
          date: gameDate,
          points: points,
          minutes: stat.min || stat.minutes || '0',
          opponent: opponent,
          home: stat.game?.home_team?.id === stat.team?.id
        };
      });

      // Return games with most recent first (for display), but we'll reverse for regression
      return {
        player: {
          id: player.id,
          first_name: player.first_name,
          last_name: player.last_name,
          position: player.position,
          team: player.team?.abbreviation || 'N/A'
        },
        games: games // Most recent first (Game 1 = most recent)
      };
    } else {
      // No stats found - throw error instead of using mock data
      throw new Error(`No game stats found for player ${playerId}. The player may not have played recently or stats are not available.`);
    }
  } catch (error) {
    console.error('❌ Error fetching player stats:', error.message);
    console.error('Response status:', error.response?.status);
    console.error('Response data:', error.response?.data);
    
    // Re-throw error instead of returning mock data
    throw error;
  }
}

/**
 * Get all active NBA players
 */
export async function getActivePlayers() {
  try {
    console.log(`Fetching active players with API key: ${BALLDONTLIE_API_KEY ? 'present' : 'missing'}`);
    const response = await balldontlieClient.get('/players', {
      params: {
        per_page: 100
      }
    });
    return response.data.data || [];
  } catch (error) {
    console.error('Error fetching active players:', error.message);
    console.error('Response status:', error.response?.status);
    throw new Error(`Failed to fetch active players: ${error.response?.data?.message || error.message}`);
  }
}

