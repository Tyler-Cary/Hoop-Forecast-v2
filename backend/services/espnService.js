import axios from 'axios';
import * as cheerio from 'cheerio';

// ESPN player ID mapping for common players (we'll search dynamically for others)
const ESPN_PLAYER_IDS = {
  115: 3975,  // Stephen Curry
  237: 1966,  // LeBron James
  145: 3202,  // Kevin Durant
  246: 4066260, // Nikola Jokic
  132: 3032977, // Giannis Antetokounmpo
  178: 4066260, // Nikola Jokic (same as above)
  228: 4278075, // Jayson Tatum
  192: 3032976, // Joel Embiid
  203: 3136774, // Devin Booker
  250: 4594267, // Anthony Edwards
  163: 6450,   // Kawhi Leonard
  149: 6430    // Jimmy Butler
};

/**
 * Get ESPN player ID - try mapping first, then search
 */
function getESPNPlayerId(balldontlieId, playerName) {
  // Check our mapping first
  if (ESPN_PLAYER_IDS[balldontlieId]) {
    return ESPN_PLAYER_IDS[balldontlieId];
  }
  
  // For now, return null and we'll try to search
  // In production, you'd want to implement a search function
  return null;
}

/**
 * Get player's recent game stats from ESPN
 * ESPN URL format: https://www.espn.com/nba/player/gamelog/_/id/{espnId}/{player-name}
 */
export async function getPlayerStatsFromESPN(playerName, balldontlieId) {
  try {
    console.log(`📊 Scraping ESPN for ${playerName} (balldontlie ID: ${balldontlieId})`);
    
    // Get ESPN player ID
    const espnId = getESPNPlayerId(balldontlieId, playerName);
    
    if (!espnId) {
      throw new Error(`ESPN player ID not found for ${playerName}. Please add mapping in ESPN_PLAYER_IDS.`);
    }
    
    // Construct URL
    const nameSlug = playerName.toLowerCase().replace(/\s+/g, '-');
    const gameLogUrl = `https://www.espn.com/nba/player/gamelog/_/id/${espnId}/${nameSlug}`;
    
    console.log(`🔍 Fetching: ${gameLogUrl}`);
    
    const response = await axios.get(gameLogUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 20000,
      maxRedirects: 5
    });
    
    if (!response.data || response.data.length < 1000) {
      throw new Error('ESPN returned empty or invalid response');
    }
    
    // ESPN embeds JSON data in the page - extract it
    let games = [];
    let jsonData = null;
    
    // Method 1: Find the script tag containing __espnfitt__
    const $ = cheerio.load(response.data);
    $('script').each((index, script) => {
      if (jsonData) return false; // Already found
      
      const scriptContent = $(script).html() || '';
      if (scriptContent.includes('__espnfitt__')) {
        // Find the JSON object
        const startIdx = scriptContent.indexOf('window.__espnfitt__');
        if (startIdx !== -1) {
          // Find the equals sign and opening brace
          const equalsIdx = scriptContent.indexOf('=', startIdx);
          const braceStart = scriptContent.indexOf('{', equalsIdx);
          
          if (braceStart !== -1) {
            // Count braces to find matching closing brace
            let braceCount = 0;
            let jsonEnd = -1;
            
            for (let i = braceStart; i < scriptContent.length; i++) {
              if (scriptContent[i] === '{') braceCount++;
              if (scriptContent[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                  jsonEnd = i;
                  break;
                }
              }
            }
            
            if (jsonEnd > braceStart) {
              jsonData = scriptContent.substring(braceStart, jsonEnd + 1);
              console.log(`✅ Found JSON data in script tag (${jsonData.length} chars)`);
              return false; // Stop searching
            }
          }
        }
      }
    });
    
    // Method 2: Direct regex on full response (if script tag method failed)
    if (!jsonData) {
      const jsonMatch = response.data.match(/window\.__espnfitt__\s*=\s*({[\s\S]+?});\s*<\/script>/);
      if (jsonMatch && jsonMatch[1]) {
        // Find balanced braces
        let braceCount = 0;
        let jsonStart = -1;
        let jsonEnd = -1;
        
        for (let i = 0; i < jsonMatch[1].length; i++) {
          if (jsonMatch[1][i] === '{') {
            if (jsonStart === -1) jsonStart = i;
            braceCount++;
          }
          if (jsonMatch[1][i] === '}') {
            braceCount--;
            if (braceCount === 0 && jsonStart !== -1) {
              jsonEnd = i;
              break;
            }
          }
        }
        
        if (jsonStart !== -1 && jsonEnd !== -1) {
          jsonData = jsonMatch[1].substring(jsonStart, jsonEnd + 1);
          console.log(`✅ Found JSON data via regex (${jsonData.length} chars)`);
        }
      }
    }
    
    if (jsonData) {
      try {
        const espnData = JSON.parse(jsonData);
        console.log('✅ Extracted ESPN JSON data');
        
        // Navigate to gamelog data - structure: page.content.gmlog.groups[0].tbls
        const groups = espnData?.page?.content?.gmlog?.groups;
        
        if (groups && Array.isArray(groups)) {
          // Find regular season group (skip preseason)
          for (const group of groups) {
            // Skip preseason - look for "Regular Season" in group name
            const groupName = group.name || '';
            if (groupName.toLowerCase().includes('preseason')) {
              console.log(`⏭️ Skipping ${groupName} group`);
              continue;
            }
            
            if (group.tbls && Array.isArray(group.tbls)) {
              for (const table of group.tbls) {
                // Skip preseason tables
                if (table.name && table.name.toLowerCase().includes('preseason')) {
                  console.log(`⏭️ Skipping ${table.name} table`);
                  continue;
                }
                
                if (table.type === 'event' && table.events && Array.isArray(table.events)) {
                  console.log(`✅ Processing ${table.events.length} events from ${groupName || 'group'}`);
                  // Process events in reverse order (most recent first)
                  const sortedEvents = [...table.events].reverse();
                  
                  for (const event of sortedEvents) {
                    if (games.length >= 10) break;
                    
                    // Extract game data from event
                    // Stats array structure from ESPN: [MIN, FG, FG%, 3PT, 3P%, FT, FT%, REB, AST, BLK, STL, PF, TO, PTS]
                    const stats = event.stats || [];
                    
                    if (stats.length === 0) continue;
                    
                    // Points is ALWAYS the last element in the stats array
                    const pointsIndex = stats.length - 1;
                    const pointsValue = stats[pointsIndex];
                    const points = typeof pointsValue === 'number' ? pointsValue : parseInt(pointsValue) || 0;
                    
                    // Minutes is the first element
                    const minutesValue = stats[0];
                    const minutes = typeof minutesValue === 'number' ? minutesValue : minutesValue || '0';
                    
                    // Date and opponent
                    const date = event.dt ? new Date(event.dt).toISOString().split('T')[0] : '';
                    const opponent = event.opp?.abbr || event.opp?.name || 'N/A';
                    const isHome = event.opp?.atVs === 'vs';
                    
                    // Validate: points should be reasonable (0-100 for NBA)
                    if (points >= 0 && points <= 100 && date && event.id && !event.id.toString().includes('preseason')) {
                      if (games.length === 0) {
                        console.log(`🔍 First game extracted: ${date} vs ${opponent} - ${points} pts`);
                        console.log(`🔍 Stats array length: ${stats.length}, Points from index ${pointsIndex}: ${pointsValue}`);
                      }
                      
                      games.push({
                        game_number: games.length + 1,
                        date: date,
                        points: points,
                        opponent: opponent,
                        minutes: String(minutes),
                        home: isHome
                      });
                    }
                  }
                }
              }
            }
          }
        }
        
        console.log(`📊 Found ${games.length} games from ESPN JSON`);
      } catch (parseError) {
        console.error('Error parsing ESPN JSON:', parseError.message);
        console.error('JSON data length:', jsonData?.length || 0);
      }
    } else {
      console.log('⚠️ Could not find ESPN JSON data in page');
    }
    
    // Fallback to HTML parsing if JSON extraction failed
    if (games.length === 0) {
      console.log('⚠️ JSON extraction failed, trying HTML parsing...');
      
      // Find all table rows
      const rows = $('table tbody tr');
      
      if (rows.length === 0) {
        console.log('❌ No table rows found in HTML');
        throw new Error('No game data found on ESPN page');
      }
      
      // Find header to identify column indices
      let ptsColIdx = -1;
      let minColIdx = -1;
      let dateColIdx = 0;
      let oppColIdx = 1;
      
      // Check thead first
      $('table thead tr th').each((index, th) => {
        const text = $(th).text().trim().toUpperCase();
        if (text === 'PTS' || text === 'POINTS') ptsColIdx = index;
        if (text === 'MIN' || text === 'MINUTES') minColIdx = index;
      });
      
      // If no thead, check first row
      if (ptsColIdx === -1) {
        rows.first().find('td, th').each((index, cell) => {
          const text = $(cell).text().trim().toUpperCase();
          if (text === 'PTS' || text === 'POINTS') ptsColIdx = index;
          if (text === 'MIN' || text === 'MINUTES') minColIdx = index;
        });
      }
      
      // Defaults if not found
      if (ptsColIdx === -1) {
        // Count columns in first data row
        const firstRowCells = rows.first().find('td');
        ptsColIdx = firstRowCells.length - 1; // Last column
      }
      if (minColIdx === -1) minColIdx = 3;
      
      console.log(`📊 Column indices - PTS: ${ptsColIdx}, MIN: ${minColIdx}, DATE: ${dateColIdx}, OPP: ${oppColIdx}`);
      
      // Parse each row
      rows.each((index, row) => {
        if (games.length >= 10) return false;
        
        const cells = $(row).find('td');
        if (cells.length < 5) return; // Skip rows with too few cells
        
        const dateText = cells.eq(dateColIdx).text().trim();
        const opponentText = cells.eq(oppColIdx).text().trim();
        
        // Skip header/total rows
        if (!dateText || dateText === 'DATE' || dateText.toLowerCase().includes('date') || 
            dateText === 'Totals' || dateText === 'Averages' || dateText === '') {
          return;
        }
        
        // Extract points
        const ptsText = cells.eq(ptsColIdx).text().trim();
        const points = parseInt(ptsText) || 0;
        
        // Validate points
        if (points < 0 || points > 100) {
          console.log(`⚠️ Skipping row with invalid points: ${points} (text: "${ptsText}")`);
          return;
        }
        
        // Extract opponent abbreviation
        let opponent = 'N/A';
        const teamMatch = opponentText.match(/\b([A-Z]{2,3})\b/);
        if (teamMatch) {
          opponent = teamMatch[1];
        } else {
          const vsMatch = opponentText.match(/(?:vs|@)\s*([A-Z]{2,3})/i);
          if (vsMatch) opponent = vsMatch[1].toUpperCase();
        }
        
        const minutes = cells.eq(minColIdx).text().trim() || '0';
        const isHome = !opponentText.includes('@');
        
        console.log(`  📊 ${dateText} vs ${opponent}: ${points} pts (PTS col ${ptsColIdx})`);
        
        games.push({
          game_number: games.length + 1,
          date: dateText,
          points: points,
          opponent: opponent,
          minutes: minutes,
          home: isHome
        });
      });
    }
    
    if (games.length === 0) {
      throw new Error('No valid games found on ESPN page');
    }
    
    // Sort by date (most recent first)
    games.sort((a, b) => {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      return dateB - dateA; // Most recent first
    });
    
    // Take only the 10 most recent games
    games = games.slice(0, 10);
    
    // Renumber games (Game 1 = most recent)
    games = games.map((game, index) => ({
      ...game,
      game_number: index + 1
    }));
    
    console.log(`✅ Successfully scraped ${games.length} games from ESPN`);
    games.slice(0, 3).forEach(game => {
      console.log(`  Game ${game.game_number}: ${game.points} pts vs ${game.opponent} on ${game.date}`);
    });
    
    return games;
  } catch (error) {
    console.error('❌ Error scraping ESPN:', error.message);
    throw new Error(`Failed to scrape ESPN: ${error.message}`);
  }
}

