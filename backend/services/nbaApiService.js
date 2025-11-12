import axios from 'axios';

/**
 * NBA.com API Service
 * Uses the official NBA.com APIs (same ones that nba_api Python package uses)
 * Documentation: https://github.com/swar/nba_api
 */

const NBA_API_BASE = 'https://stats.nba.com/stats';
const NBA_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://www.nba.com/',
  'Origin': 'https://www.nba.com'
};

/**
 * Search for a player by name
 */
export async function searchPlayer(playerName) {
  try {
    // NBA.com uses a commonallplayers endpoint
    const url = `${NBA_API_BASE}/commonallplayers`;
    const params = {
      LeagueID: '00',
      Season: getCurrentSeason(),
      IsOnlyCurrentSeason: 0
    };
    
    const response = await axios.get(url, {
      params,
      headers: NBA_HEADERS,
      timeout: 10000
    });
    
    if (response.data && response.data.resultSets && response.data.resultSets[0]) {
      const players = response.data.resultSets[0].rowSet || [];
      const headers = response.data.resultSets[0].headers || [];
      
      // Find player index
      const playerNameIndex = headers.indexOf('DISPLAY_FIRST_LAST') !== -1 
        ? headers.indexOf('DISPLAY_FIRST_LAST')
        : headers.indexOf('PLAYER_NAME') !== -1
        ? headers.indexOf('PLAYER_NAME')
        : 1;
      
      const playerIdIndex = headers.indexOf('PERSON_ID') !== -1
        ? headers.indexOf('PERSON_ID')
        : 0;
      
      // Search for matching player
      const searchName = playerName.toLowerCase();
      const matches = players.filter(player => {
        const name = (player[playerNameIndex] || '').toLowerCase();
        return name.includes(searchName);
      });
      
      if (matches.length > 0) {
        const player = matches[0];
        return {
          id: player[playerIdIndex],
          name: player[playerNameIndex],
          team: player[headers.indexOf('TEAM_ABBREVIATION')] || 'N/A'
        };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error searching NBA.com:', error.message);
    throw error;
  }
}

/**
 * Get player's game log (last 10 games)
 */
export async function getPlayerGameLog(playerId) {
  try {
    const currentSeason = getCurrentSeason();
    
    // Use playergamelog endpoint
    const url = `${NBA_API_BASE}/playergamelog`;
    const params = {
      LeagueID: '00',
      PlayerID: playerId,
      Season: currentSeason,
      SeasonType: 'Regular Season'
    };
    
    console.log(`📊 Fetching game log from NBA.com for player ${playerId}...`);
    
    const response = await axios.get(url, {
      params,
      headers: NBA_HEADERS,
      timeout: 15000
    });
    
    if (!response.data || !response.data.resultSets || !response.data.resultSets[0]) {
      throw new Error('Invalid response from NBA.com API');
    }
    
    const gameLog = response.data.resultSets[0];
    const headers = gameLog.headers || [];
    const games = gameLog.rowSet || [];
    
    // Find column indices
    const gameDateIndex = headers.indexOf('GAME_DATE');
    const matchupIndex = headers.indexOf('MATCHUP');
    const ptsIndex = headers.indexOf('PTS');
    const minIndex = headers.indexOf('MIN');
    const wlIndex = headers.indexOf('WL'); // Win/Loss
    
    if (ptsIndex === -1) {
      throw new Error('Could not find PTS column in NBA.com response');
    }
    
    // Process games (most recent first, take last 10)
    const processedGames = games.slice(0, 10).map((game, index) => {
      const gameDate = game[gameDateIndex] || '';
      const matchup = game[matchupIndex] || '';
      const points = parseInt(game[ptsIndex]) || 0;
      const minutes = game[minIndex] || '0';
      const result = game[wlIndex] || '';
      
      // Parse opponent from matchup
      // NBA.com format: "GSW vs. LAL" (GSW is home) or "GSW @ LAL" (GSW is away)
      // The FIRST team is always the player's team, SECOND is the opponent
      let opponent = 'N/A';
      let isHome = false;
      
      if (matchup) {
        // Check if it's a home game (contains "vs.")
        if (matchup.includes('vs.')) {
          isHome = true;
          // Split by "vs." - format: "GSW vs. LAL"
          // parts[0] = player's team (GSW), parts[1] = opponent (LAL)
          const parts = matchup.split('vs.');
          if (parts.length >= 2) {
            // Get the opponent (second part)
            opponent = parts[1].trim();
          }
        } else if (matchup.includes('@')) {
          // Away game - split by "@" - format: "GSW @ LAL"
          // parts[0] = player's team (GSW), parts[1] = opponent (LAL)
          isHome = false;
          const parts = matchup.split('@');
          if (parts.length >= 2) {
            // Get the opponent (second part)
            opponent = parts[1].trim();
          }
        }
        
        // Clean up opponent - extract just the 3-letter team abbreviation
        if (opponent && opponent !== 'N/A') {
          // Remove any extra whitespace and extract team code
          opponent = opponent.trim();
          
          // Extract the 3-letter team abbreviation (e.g., "LAL" from "LAL" or "LAL 123-456")
          const teamMatch = opponent.match(/\b([A-Z]{2,3})\b/);
          if (teamMatch) {
            opponent = teamMatch[1];
          } else {
            // Fallback: take first 3 characters if it looks like a team code
            const firstPart = opponent.split(' ')[0];
            if (firstPart.length >= 2 && firstPart.length <= 3) {
              opponent = firstPart.toUpperCase();
            }
          }
        }
        
        // Debug logging for first game
        if (index === 0) {
          console.log(`  🔍 Matchup parsing: "${matchup}" → opponent: "${opponent}", home: ${isHome}`);
        }
      }
      
      // Format date (NBA.com returns "2025-11-12" format)
      const formattedDate = gameDate || '';
      
      return {
        game_number: index + 1,
        date: formattedDate,
        points: points,
        opponent: opponent,
        minutes: minutes,
        home: isHome,
        result: result
      };
    });
    
    console.log(`✅ Retrieved ${processedGames.length} games from NBA.com`);
    processedGames.slice(0, 3).forEach(game => {
      console.log(`  Game ${game.game_number}: ${game.points} pts vs ${game.opponent} on ${game.date}`);
    });
    
    return processedGames;
  } catch (error) {
    console.error('❌ Error fetching NBA.com game log:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw new Error(`Failed to fetch NBA.com game log: ${error.message}`);
  }
}

/**
 * Get player's next scheduled game
 */
export async function getNextGame(nbaPlayerId, teamAbbrev) {
  try {
    if (!nbaPlayerId || !teamAbbrev) {
      return null;
    }
    
    const currentSeason = getCurrentSeason();
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0].replace(/-/g, '');
    
    // Get team schedule to find next game
    // First, we need to get the team ID from abbreviation
    const teamScheduleUrl = `${NBA_API_BASE}/teamschedule`;
    const params = {
      LeagueID: '00',
      Season: currentSeason,
      SeasonType: 'Regular Season',
      TeamID: 0 // We'll need to map abbreviation to ID
    };
    
    // Try using scoreboard to find upcoming games for the team
    // Check next 7 days for games
    for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() + dayOffset);
      const dateStr = checkDate.toISOString().split('T')[0].replace(/-/g, '');
      
      try {
        const scoreboardUrl = `${NBA_API_BASE}/scoreboard`;
        const scoreboardResponse = await axios.get(scoreboardUrl, {
          params: {
            LeagueID: '00',
            GameDate: dateStr,
            DayOffset: dayOffset
          },
          headers: NBA_HEADERS,
          timeout: 10000
        });
        
        if (scoreboardResponse.data && scoreboardResponse.data.resultSets) {
          const games = scoreboardResponse.data.resultSets[0]?.rowSet || [];
          
          // Find game with the player's team
          for (const game of games) {
            const homeTeam = game[6]; // Home team abbreviation
            const awayTeam = game[7]; // Away team abbreviation
            
            if (homeTeam === teamAbbrev || awayTeam === teamAbbrev) {
              const opponent = homeTeam === teamAbbrev ? awayTeam : homeTeam;
              const gameDate = game[0]; // Game date
              const gameTime = game[2] || 'TBD'; // Game time
              
              return {
                opponent: opponent,
                date: formatGameDate(gameDate),
                time: gameTime,
                isHome: homeTeam === teamAbbrev
              };
            }
          }
        }
      } catch (err) {
        // Continue to next day
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching next game:', error.message);
    return null;
  }
}

/**
 * Format game date from NBA.com format
 */
function formatGameDate(dateStr) {
  if (!dateStr) return 'TBD';
  try {
    // NBA.com format: "20251112" -> "Nov 12, 2025"
    if (dateStr.length === 8) {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      const date = new Date(`${year}-${month}-${day}`);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    return dateStr;
  } catch (e) {
    return dateStr;
  }
}

/**
 * Get current NBA season (e.g., "2024-25")
 */
function getCurrentSeason() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // 1-12
  
  // NBA season runs from October to June
  // If we're before October, use previous season
  if (month < 10) {
    return `${year - 1}-${String(year).slice(-2)}`;
  } else {
    return `${year}-${String(year + 1).slice(-2)}`;
  }
}

/**
 * Get player info by ID
 */
export async function getPlayerInfo(playerId) {
  try {
    const url = `${NBA_API_BASE}/commonplayerinfo`;
    const params = {
      PlayerID: playerId
    };
    
    const response = await axios.get(url, {
      params,
      headers: NBA_HEADERS,
      timeout: 10000
    });
    
    if (response.data && response.data.resultSets && response.data.resultSets[0]) {
      const playerData = response.data.resultSets[0].rowSet[0];
      const headers = response.data.resultSets[0].headers;
      
      return {
        id: playerId,
        first_name: playerData[headers.indexOf('FIRST_NAME')] || '',
        last_name: playerData[headers.indexOf('LAST_NAME')] || '',
        display_name: playerData[headers.indexOf('DISPLAY_FIRST_LAST')] || '',
        team: playerData[headers.indexOf('TEAM_ABBREVIATION')] || 'N/A',
        position: playerData[headers.indexOf('POSITION')] || 'N/A'
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching player info:', error.message);
    throw error;
  }
}

