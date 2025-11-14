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
 * Search for players by name using ESPN API
 * Returns array of matching players (for search functionality)
 */
export async function searchPlayersESPN(playerName) {
  try {
    console.log(`🔍 Searching ESPN for players: "${playerName}"`);
    
    const normalizeName = (value) => {
      if (!value) return '';
      return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
        .replace(/[^a-z0-9\s]/g, '') // Remove punctuation/special characters
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    const searchName = normalizeName(playerName);
    const searchTokens = searchName.split(' ').filter(Boolean);
    const results = [];
    
    // ESPN API endpoint for NBA teams
    const teamsUrl = 'https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/teams';
    
    // Get all NBA teams
    const teamsResponse = await axios.get(teamsUrl, {
      params: {
        region: 'us',
        lang: 'en',
        contentorigin: 'espn',
        limit: 50
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json'
      },
      timeout: 15000
    });
    
    if (!teamsResponse.data || !teamsResponse.data.sports || !teamsResponse.data.sports[0]) {
      throw new Error('Invalid response from ESPN teams API');
    }
    
    const leagues = teamsResponse.data.sports[0].leagues || [];
    const teams = leagues[0]?.teams || [];
    
    console.log(`📋 Found ${teams.length} teams from ESPN`);
    
    // Get rosters for each team in parallel (limit to avoid rate limits)
    const teamPromises = teams.slice(0, 30).map(async (team) => {
      try {
        const teamId = team.team?.id;
        if (!teamId) return [];
        
        const rosterUrl = `https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${teamId}/roster`;
        
        const rosterResponse = await axios.get(rosterUrl, {
          params: {
            region: 'us',
            lang: 'en',
            contentorigin: 'espn'
          },
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Accept': 'application/json'
          },
          timeout: 10000
        });
        
        if (!rosterResponse.data) {
          return [];
        }
        
        const athletesGroups = Array.isArray(rosterResponse.data.athletes)
          ? rosterResponse.data.athletes
          : [];
        const athletes = athletesGroups.flatMap(group => {
          if (!group) return [];
          if (Array.isArray(group.items)) {
            return group.items;
          }
          return group; // in case API already returns flat array
        });
        
        const teamAbbrev = team.team?.abbreviation || team.team?.shortDisplayName || 'N/A';
        const teamName = team.team?.displayName || team.team?.name || 'N/A';
        
        // Filter athletes matching search name
        const matchingPlayers = athletes
          .filter(athlete => {
            const base = athlete.athlete || athlete;
            if (!base) return false;
            
            const fullNameRaw = `${base.firstName || ''} ${base.lastName || ''}`.trim();
            const displayNameRaw = base.displayName || fullNameRaw;
            const shortNameRaw = base.shortName || displayNameRaw;
            
            const fullName = normalizeName(fullNameRaw);
            const displayName = normalizeName(displayNameRaw);
            const shortName = normalizeName(shortNameRaw);
            
            if (!fullName && !displayName && !shortName) {
              return false;
            }
            
            if (fullName.includes(searchName) || displayName.includes(searchName) || shortName.includes(searchName)) {
              return true;
            }
            
            if (searchTokens.length > 1) {
              return searchTokens.every(token => 
                fullName.includes(token) || displayName.includes(token) || shortName.includes(token)
              );
            }
            
            return fullName.startsWith(searchName) || displayName.startsWith(searchName) || shortName.startsWith(searchName);
          })
          .map(athlete => {
            const base = athlete.athlete || athlete;
            const positionInfo = athlete.position || base.position || {};
            const headshot = base.headshot?.href || base.headshot || null;
            const jersey = base.jersey || athlete.jersey || null;
            const playerId = base.id || athlete.id;
            const firstName = base.firstName || '';
            const lastName = base.lastName || '';
            const fullName = `${firstName} ${lastName}`.trim();
            
            return {
              id: playerId, // ESPN ID
              first_name: firstName,
              last_name: lastName,
              full_name: fullName,
              display_name: base.displayName || fullName,
              position: positionInfo.abbreviation || positionInfo.name || 'N/A',
              team: {
                abbreviation: teamAbbrev,
                name: teamName
              },
              team_name: teamName,
              jersey: jersey,
              headshot: headshot,
              espn_id: playerId
            };
          });
        
        return matchingPlayers;
      } catch (error) {
        // Silently skip teams that fail (rate limits, etc.)
        return [];
      }
    });
    
    // Wait for all roster requests (with some delay to avoid rate limits)
    const rosterResults = await Promise.allSettled(teamPromises);
    
    // Flatten results
    for (const result of rosterResults) {
      if (result.status === 'fulfilled' && Array.isArray(result.value)) {
        results.push(...result.value);
      }
    }
    
    // Remove duplicates (same player ID)
    const uniqueResults = [];
    const seenIds = new Set();
    for (const player of results) {
      if (!seenIds.has(player.id)) {
        seenIds.add(player.id);
        uniqueResults.push(player);
      }
    }
    
    // Sort by relevance (exact name matches first)
    uniqueResults.sort((a, b) => {
      const aName = normalizeName(a.full_name);
      const bName = normalizeName(b.full_name);
      const aStarts = aName.startsWith(searchName);
      const bStarts = bName.startsWith(searchName);
      
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return aName.localeCompare(bName);
    });
    
    console.log(`✅ Found ${uniqueResults.length} matching players from ESPN`);
    return uniqueResults.slice(0, 25);
    
  } catch (error) {
    console.error('❌ Error searching ESPN for players:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', JSON.stringify(error.response.data).substring(0, 200));
    }
    throw new Error(`Failed to search players on ESPN: ${error.message}`);
  }
}

/**
 * Get player stats directly from NBA.com API using player name
 * Returns stats in the same format as balldontlie service
 */
export async function getPlayerStatsFromNBA(playerName) {
  try {
    console.log(`📊 Fetching stats from NBA.com for: ${playerName}`);
    
    // Search for player
    const nbaPlayer = await searchPlayer(playerName);
    
    if (!nbaPlayer || !nbaPlayer.id) {
      throw new Error(`Player "${playerName}" not found on NBA.com`);
    }
    
    console.log(`✅ Found NBA.com player: ${nbaPlayer.name} (ID: ${nbaPlayer.id})`);
    
    // Get game log
    const games = await getPlayerGameLog(nbaPlayer.id, {
      includePreviousSeason: true,
      currentSeasonGames: 10,
      previousSeasonGames: 20
    });
    
    if (!games || games.length === 0) {
      throw new Error(`No game data found for ${playerName}`);
    }
    
    // Get player info for additional details
    let playerInfo = null;
    try {
      playerInfo = await getPlayerInfo(nbaPlayer.id);
    } catch (infoError) {
      console.log(`⚠️ Could not fetch detailed player info: ${infoError.message}`);
    }
    
    // Parse player name
    const nameParts = nbaPlayer.name.split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    
    const teamAbbrev = typeof nbaPlayer.team === 'string'
      ? nbaPlayer.team
      : nbaPlayer.team?.abbreviation || nbaPlayer.team?.name || 'N/A';
    const teamName = typeof nbaPlayer.team === 'object'
      ? nbaPlayer.team?.name || nbaPlayer.team?.abbreviation || 'N/A'
      : nbaPlayer.team || 'N/A';

    return {
      player: {
        id: nbaPlayer.id,
        nba_id: nbaPlayer.id,
        first_name: playerInfo?.first_name || firstName,
        last_name: playerInfo?.last_name || lastName,
        position: playerInfo?.position || 'N/A',
        team: teamAbbrev,
        team_name: teamName,
        team_details: {
          abbreviation: teamAbbrev,
          name: teamName
        }
      },
      games: games
    };
  } catch (error) {
    console.error(`❌ Error fetching stats from NBA.com for ${playerName}:`, error.message);
    throw error;
  }
}

/**
 * Search for a player by name (legacy function - kept for backward compatibility)
 * Uses NBA.com API - returns single player match
 */
export async function searchPlayer(playerName) {
  try {
    // NBA.com uses a commonallplayers endpoint
    const url = `${NBA_API_BASE}/commonallplayers`;
    const normalizeName = (value) => {
      if (!value) return '';
      return value
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    const searchTokens = normalizeName(playerName).split(' ').filter(Boolean);
    
    // Try with retry logic for rate limiting
    let response = null;
    let lastError = null;
    
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await axios.get(url, {
          params: {
            LeagueID: '00',
            Season: getCurrentSeason(),
            IsOnlyCurrentSeason: 0
          },
          headers: NBA_HEADERS,
          timeout: 20000, // Increased timeout
          validateStatus: (status) => status < 500 // Don't throw on 403/404
        });
        
        // Check if we got a valid response
        if (response.status === 403 || response.status === 429) {
          if (attempt < 2) {
            console.log(`⚠️ NBA.com search returned ${response.status}, waiting before retry ${attempt + 1}/3...`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
            continue;
          } else {
            throw new Error(`NBA.com API returned ${response.status}. The API may be rate-limiting requests.`);
          }
        }
        
        break; // Success
      } catch (error) {
        lastError = error;
        if (error.response && (error.response.status === 403 || error.response.status === 429)) {
          if (attempt < 2) {
            console.log(`⚠️ NBA.com search error ${error.response.status}, waiting before retry ${attempt + 1}/3...`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
            continue;
          }
        }
        // If it's a timeout or other error on last attempt, throw
        if (attempt === 2 || (error.code === 'ECONNABORTED' && attempt >= 1)) {
          throw error;
        }
      }
    }
    
    if (!response) {
      throw lastError || new Error('Failed to search NBA.com after retries');
    }
    
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
        const displayNameRaw = player[playerNameIndex] || '';
        const normalizedName = normalizeName(displayNameRaw);
        if (!normalizedName) return false;
        if (searchTokens.length === 0) return false;
        return searchTokens.every(token => normalizedName.includes(token));
      });
      
      const mappedPlayers = matches.slice(0, 50).map(player => {
        const displayNameRaw = player[playerNameIndex] || '';
        const [firstName, ...rest] = displayNameRaw.split(' ');
        const lastName = rest.join(' ');
        return {
          id: player[playerIdIndex],
          name: displayNameRaw,
          nameParts: {
            firstName: firstName || '',
            lastName: lastName || '',
            fullName: displayNameRaw
          },
          team: {
            abbreviation: player[headers.indexOf('TEAM_ABBREVIATION')] || 'N/A',
            name: player[headers.indexOf('TEAM_ABBREVIATION')] || 'N/A'
          },
          position: player[headers.indexOf('POSITION')] || 'N/A',
          headshot: null,
          source: 'commonallplayers'
        };
      });
      
      if (mappedPlayers.length === 0) {
        return null;
      }
      
      // Rank best match: exact normalized name first, then startswith, otherwise first result
      const normalizedSearch = normalizeName(playerName);
      const bestMatch = mappedPlayers.find(p => normalizeName(p.nameParts.fullName) === normalizedSearch)
        || mappedPlayers.find(p => normalizeName(p.nameParts.fullName).startsWith(normalizedSearch))
        || mappedPlayers[0];
      
      return bestMatch;
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
export async function getPlayerGameLog(playerId, options = {}) {
  try {
    const {
      includePreviousSeason = false,
      currentSeasonGames = 10,
      previousSeasonGames = 20
    } = options;

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
    
    // Try with retry logic for rate limiting
    let response = null;
    let lastError = null;
    
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await axios.get(url, {
          params,
          headers: NBA_HEADERS,
          timeout: 20000, // Increased timeout
          validateStatus: (status) => status < 500
        });
        
        if (response.status === 403 || response.status === 429) {
          if (attempt < 2) {
            console.log(`⚠️ NBA.com game log returned ${response.status}, waiting before retry ${attempt + 1}/3...`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
            continue;
          } else {
            throw new Error(`NBA.com API returned ${response.status}. The API may be rate-limiting requests.`);
          }
        }
        
        break;
      } catch (error) {
        lastError = error;
        if (error.response && (error.response.status === 403 || error.response.status === 429)) {
          if (attempt < 2) {
            console.log(`⚠️ NBA.com game log error ${error.response.status}, waiting before retry ${attempt + 1}/3...`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
            continue;
          }
        }
        if (attempt === 2 || (error.code === 'ECONNABORTED' && attempt >= 1)) {
          throw error;
        }
      }
    }
    
    if (!response) {
      throw lastError || new Error('Failed to fetch game log from NBA.com after retries');
    }
    
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
    const processGames = (gamesArray, seasonLabel, limit) => {
      return gamesArray.slice(0, limit).map((game, index) => {
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
        if (index === 0 && seasonLabel === currentSeason) {
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
        result: result,
        season: seasonLabel
      };
      });
    };

    const processedCurrentGames = processGames(games, currentSeason, currentSeasonGames);

    let processedPreviousGames = [];
    if (includePreviousSeason) {
      try {
        const previousSeason = getPreviousSeason(currentSeason);
        console.log(`📊 Fetching previous season (${previousSeason}) game log for player ${playerId}...`);
        
        const previousResponse = await axios.get(url, {
          params: {
            LeagueID: '00',
            PlayerID: playerId,
            Season: previousSeason,
            SeasonType: 'Regular Season'
          },
          headers: NBA_HEADERS,
          timeout: 15000
        });
        
        if (previousResponse.data?.resultSets?.[0]) {
          const previousGameLog = previousResponse.data.resultSets[0];
          const previousGamesArray = previousGameLog.rowSet || [];
          processedPreviousGames = processGames(previousGamesArray, previousSeason, previousSeasonGames);
        }
      } catch (prevError) {
        console.log(`⚠️ Could not fetch previous season data: ${prevError.message}`);
      }
    }
    
    const processedGames = [...processedCurrentGames, ...processedPreviousGames].map((game, index) => ({
      ...game,
      game_number: index + 1
    }));
    
    console.log(`✅ Retrieved ${processedGames.length} games from NBA.com (current season: ${processedCurrentGames.length}, previous seasons: ${processedPreviousGames.length})`);
    processedGames.slice(0, 3).forEach(game => {
      console.log(`  Game ${game.game_number}: ${game.points} pts vs ${game.opponent} on ${game.date} (Season ${game.season})`);
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
 * Uses ESPN's free API (no authentication required)
 * @param {number|null} nbaPlayerId - NBA.com player ID (optional, not needed for ESPN API)
 * @param {string} teamAbbrev - Team abbreviation (required)
 */
export async function getNextGame(nbaPlayerId, teamAbbrev) {
  try {
    // ESPN API only needs team abbreviation, nbaPlayerId is optional
    if (!teamAbbrev || teamAbbrev === 'N/A') {
      console.log(`⚠️ Missing team abbreviation for getNextGame: teamAbbrev=${teamAbbrev}`);
      return null;
    }
    
    console.log(`🔍 Fetching next game for team: ${teamAbbrev} using ESPN API`);
    
    // Map team abbreviation to ESPN team ID
    const espnTeamId = getEspnTeamId(teamAbbrev);
    if (!espnTeamId) {
      console.log(`⚠️ Could not find ESPN team ID for abbreviation: ${teamAbbrev}`);
      return null;
    }
    
    console.log(`✅ Found ESPN team ID: ${espnTeamId} for ${teamAbbrev}`);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Use ESPN's team schedule endpoint
    try {
      const espnScheduleUrl = `https://site.web.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${espnTeamId}/schedule`;
      const scheduleResponse = await axios.get(espnScheduleUrl, {
        params: {
          region: 'us',
          lang: 'en',
          contentorigin: 'espn'
        },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Accept': 'application/json'
        },
        timeout: 10000
      });
      
      console.log(`📥 ESPN schedule response status: ${scheduleResponse.status}`);
      
      if (scheduleResponse.data && scheduleResponse.data.events) {
        const events = scheduleResponse.data.events || [];
        console.log(`📅 Found ${events.length} games in ESPN schedule`);
        
        // Find next game (future game)
        for (const event of events) {
          if (!event.date) continue;
          
          // Parse game date
          const gameDate = new Date(event.date);
          gameDate.setHours(0, 0, 0, 0);
          
          // Check if this is a future game
          if (gameDate >= today) {
            // This is the next game!
            const competitions = event.competitions || [];
            if (competitions.length > 0) {
              const competition = competitions[0];
              const competitors = competition.competitors || [];
              
              // Find opponent
              let opponent = null;
              let isHome = false;
              
              // Normalize team abbreviation for comparison (ESPN uses GS, UTAH, etc.)
              const normalizedTeamAbbrev = normalizeEspnAbbrev(teamAbbrev);
              
              for (const competitor of competitors) {
                const teamAbbrevFromEspn = competitor.team?.abbreviation || competitor.team?.shortDisplayName || '';
                const normalizedEspnAbbrev = normalizeEspnAbbrev(teamAbbrevFromEspn);
                const isHomeTeam = competitor.homeAway === 'home';
                
                if (normalizedEspnAbbrev === normalizedTeamAbbrev) {
                  isHome = isHomeTeam;
                } else {
                  // Map ESPN abbreviation back to standard NBA abbreviation
                  opponent = mapEspnToNbaAbbrev(teamAbbrevFromEspn) || teamAbbrevFromEspn;
                }
              }
              
              if (opponent) {
                // Format date
                const formattedDate = gameDate.toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric', 
                  year: 'numeric' 
                });
                
                // Get game time if available
                let gameTime = 'TBD';
                if (event.date) {
                  const timeDate = new Date(event.date);
                  const hours = timeDate.getHours();
                  const minutes = timeDate.getMinutes();
                  if (hours !== 0 || minutes !== 0) {
                    gameTime = timeDate.toLocaleTimeString('en-US', { 
                      hour: 'numeric', 
                      minute: '2-digit',
                      hour12: true 
                    });
                  }
                }
                
                console.log(`✅ Found next game via ESPN: ${teamAbbrev} vs ${opponent} on ${formattedDate}`);
                return {
                  opponent: opponent,
                  date: formattedDate,
                  time: gameTime,
                  isHome: isHome
                };
              }
            }
          }
        }
      }
    } catch (espnError) {
      console.log(`⚠️ ESPN schedule endpoint failed: ${espnError.message}`);
      if (espnError.response) {
        console.log(`   Status: ${espnError.response.status}`);
        console.log(`   Data:`, JSON.stringify(espnError.response.data).substring(0, 200));
      }
    }
    
    console.log(`❌ Could not find next game for ${teamAbbrev}`);
    return null;
  } catch (error) {
    console.error('Error fetching next game:', error.message);
    console.error('Stack:', error.stack);
    return null;
  }
}

/**
 * Normalize ESPN team abbreviation to standard NBA abbreviation
 */
function normalizeEspnAbbrev(abbrev) {
  if (!abbrev) return '';
  const upper = abbrev.toUpperCase();
  // ESPN uses GS, UTAH, etc. - normalize to standard
  if (upper === 'GS') return 'GSW';
  if (upper === 'UTAH') return 'UTA';
  return upper;
}

/**
 * Map ESPN abbreviation back to standard NBA abbreviation
 */
function mapEspnToNbaAbbrev(espnAbbrev) {
  if (!espnAbbrev) return null;
  const upper = espnAbbrev.toUpperCase();
  const mapping = {
    'GS': 'GSW',
    'UTAH': 'UTA'
  };
  return mapping[upper] || upper;
}

/**
 * Get ESPN team ID from NBA team abbreviation
 * Note: ESPN uses different abbreviations for some teams (e.g., GS instead of GSW, UTAH instead of UTA)
 */
function getEspnTeamId(abbrev) {
  const teamMap = {
    'ATL': '1',      // Atlanta Hawks
    'BOS': '2',      // Boston Celtics
    'BKN': '17',     // Brooklyn Nets
    'CHA': '30',     // Charlotte Hornets
    'CHI': '4',      // Chicago Bulls
    'CLE': '5',      // Cleveland Cavaliers
    'DAL': '6',      // Dallas Mavericks
    'DEN': '7',      // Denver Nuggets
    'DET': '8',      // Detroit Pistons
    'GSW': '9',      // Golden State Warriors (ESPN uses "GS" but we map GSW -> 9)
    'GS': '9',       // Golden State Warriors (ESPN abbreviation)
    'HOU': '10',     // Houston Rockets
    'IND': '11',     // Indiana Pacers
    'LAC': '12',     // LA Clippers
    'LAL': '13',     // Los Angeles Lakers
    'MEM': '29',     // Memphis Grizzlies
    'MIA': '14',     // Miami Heat
    'MIL': '15',     // Milwaukee Bucks
    'MIN': '16',     // Minnesota Timberwolves
    'NO': '3',       // New Orleans Pelicans
    'NOP': '3',      // New Orleans Pelicans
    'NYK': '18',     // New York Knicks
    'OKC': '25',     // Oklahoma City Thunder
    'ORL': '19',     // Orlando Magic
    'PHI': '20',     // Philadelphia 76ers
    'PHX': '21',     // Phoenix Suns
    'POR': '22',     // Portland Trail Blazers
    'SAC': '23',     // Sacramento Kings
    'SA': '24',      // San Antonio Spurs
    'SAS': '24',     // San Antonio Spurs
    'TOR': '28',     // Toronto Raptors
    'UTA': '26',     // Utah Jazz
    'UTAH': '26',    // Utah Jazz (ESPN abbreviation)
    'WAS': '27'      // Washington Wizards
  };
  
  return teamMap[abbrev.toUpperCase()] || null;
}

/**
 * Get team ID from abbreviation
 */
function getTeamIdFromAbbrev(abbrev) {
  const teamMap = {
    'ATL': 1610612737,
    'BOS': 1610612738,
    'BKN': 1610612751,
    'CHA': 1610612766,
    'CHI': 1610612741,
    'CLE': 1610612739,
    'DAL': 1610612742,
    'DEN': 1610612743,
    'DET': 1610612765,
    'GSW': 1610612744,
    'HOU': 1610612745,
    'IND': 1610612754,
    'LAC': 1610612746,
    'LAL': 1610612747,
    'MEM': 1610612763,
    'MIA': 1610612748,
    'MIL': 1610612749,
    'MIN': 1610612750,
    'NO': 1610612740,
    'NOP': 1610612740,
    'NYK': 1610612752,
    'OKC': 1610612760,
    'ORL': 1610612753,
    'PHI': 1610612755,
    'PHX': 1610612756,
    'POR': 1610612757,
    'SAC': 1610612758,
    'SA': 1610612759,
    'SAS': 1610612759,
    'TOR': 1610612761,
    'UTA': 1610612762,
    'WAS': 1610612764
  };
  
  return teamMap[abbrev.toUpperCase()] || null;
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
 * Get previous NBA season string given current season (e.g., "2024-25" -> "2023-24")
 */
function getPreviousSeason(season) {
  if (!season || !season.includes('-')) {
    const current = getCurrentSeason();
    return getPreviousSeason(current);
  }
  
  const [start, end] = season.split('-');
  const startYear = parseInt(start, 10);
  const previousStartYear = startYear - 1;
  const previousEndYearShort = String(startYear).slice(-2);
  return `${previousStartYear}-${previousEndYearShort}`;
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
    
    // Try with longer timeout and retry logic
    let response = null;
    let lastError = null;
    
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        response = await axios.get(url, {
          params,
          headers: NBA_HEADERS,
          timeout: 20000, // Increased timeout
          validateStatus: (status) => status < 500 // Don't throw on 403/404, handle it
        });
        
        // Check if we got a valid response
        if (response.status === 403 || response.status === 429) {
          // Rate limited or blocked - wait a bit and retry
          if (attempt < 2) {
            console.log(`⚠️ NBA.com returned ${response.status}, waiting before retry ${attempt + 1}/3...`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1))); // Exponential backoff
            continue;
          } else {
            throw new Error(`NBA.com API returned ${response.status}. The API may be rate-limiting requests.`);
          }
        }
        
        // Success
        break;
      } catch (error) {
        lastError = error;
        if (error.response && (error.response.status === 403 || error.response.status === 429)) {
          if (attempt < 2) {
            console.log(`⚠️ NBA.com error ${error.response.status}, waiting before retry ${attempt + 1}/3...`);
            await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
            continue;
          }
        }
        // If it's a timeout or other error, throw immediately
        if (attempt === 2 || error.code === 'ECONNABORTED') {
          throw error;
        }
      }
    }
    
    if (!response) {
      throw lastError || new Error('Failed to fetch from NBA.com after retries');
    }
    
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

