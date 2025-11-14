import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const THE_ODDS_API_KEY = process.env.THE_ODDS_API_KEY || process.env.ODDS_API_KEY;
const THE_ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

const preferredBookmakers = [
  'draftkings',
  'fanduel',
  'betmgm',
  'caesars',
  'pointsbet',
  'barstool',
  'betrivers',
  'wynnbet',
  'unibet',
  'foxbet'
];

const normalize = (value) => {
  if (!value) return '';
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * Normalize team name/abbreviation for matching
 */
function normalizeTeam(team) {
  if (!team) return '';
  const normalized = normalize(team);
  // Map common variations
  const teamMap = {
    'gs': 'warriors',
    'gsw': 'warriors',
    'golden state': 'warriors',
    'sa': 'spurs',
    'sas': 'spurs',
    'san antonio': 'spurs',
    'phx': 'suns',
    'pho': 'suns',
    'phoenix': 'suns',
    'ny': 'knicks',
    'nyk': 'knicks',
    'new york': 'knicks',
    'bkn': 'nets',
    'bro': 'nets',
    'brooklyn': 'nets',
    'utah': 'jazz',
    'uta': 'jazz'
  };
  return teamMap[normalized] || normalized;
}

/**
 * Match event to player's team and opponent
 */
function matchesEvent(event, teamAbbrev, opponentAbbrev) {
  if (!event || !event.home_team || !event.away_team) return false;
  if (!teamAbbrev || !opponentAbbrev) return false;
  
  const homeTeam = normalize(event.home_team);
  const awayTeam = normalize(event.away_team);
  const normalizedTeam = normalize(teamAbbrev);
  const normalizedOpponent = normalize(opponentAbbrev);
  
  // Map team abbreviations to full names for better matching
  const teamNameMap = {
    'cle': ['cleveland', 'cavaliers', 'cavs'],
    'mem': ['memphis', 'grizzlies'],
    'gsw': ['golden state', 'warriors'],
    'sas': ['san antonio', 'spurs'],
    'nyk': ['new york', 'knicks'],
    'lal': ['los angeles lakers', 'lakers'],
    'bos': ['boston', 'celtics'],
    'mia': ['miami', 'heat'],
    'chi': ['chicago', 'bulls'],
    'phi': ['philadelphia', '76ers', 'sixers'],
    'atl': ['atlanta', 'hawks'],
    'tor': ['toronto', 'raptors'],
    'was': ['washington', 'wizards'],
    'det': ['detroit', 'pistons'],
    'mil': ['milwaukee', 'bucks'],
    'phx': ['phoenix', 'suns'],
    'bkn': ['brooklyn', 'nets'],
    'uta': ['utah', 'jazz'],
    'den': ['denver', 'nuggets'],
    'por': ['portland', 'trail blazers', 'blazers'],
    'lac': ['los angeles clippers', 'clippers'],
    'sac': ['sacramento', 'kings'],
    'min': ['minnesota', 'timberwolves'],
    'nop': ['new orleans', 'pelicans'],
    'hou': ['houston', 'rockets'],
    'dal': ['dallas', 'mavericks'],
    'okc': ['oklahoma city', 'thunder'],
    'orl': ['orlando', 'magic'],
    'cha': ['charlotte', 'hornets'],
    'ind': ['indiana', 'pacers']
  };
  
  const teamVariations = teamNameMap[normalizedTeam] || [normalizedTeam];
  const opponentVariations = teamNameMap[normalizedOpponent] || [normalizedOpponent];
  
  // Check if home team matches player's team and away team matches opponent (or vice versa)
  const homeMatchesTeam = teamVariations.some(v => homeTeam.includes(v));
  const awayMatchesOpponent = opponentVariations.some(v => awayTeam.includes(v));
  const homeMatchesOpponent = opponentVariations.some(v => homeTeam.includes(v));
  const awayMatchesTeam = teamVariations.some(v => awayTeam.includes(v));
  
  return (homeMatchesTeam && awayMatchesOpponent) || (homeMatchesOpponent && awayMatchesTeam);
}

/**
 * Fetch player points prop line from The Odds API
 * Makes TWO API requests: first to get events, then to get odds for the matching event
 * @param {string|null} playerId - Player ID (optional, not used)
 * @param {string} playerName - Player name (required)
 * @param {object} gameInfo - Game information (optional, helps match the correct event)
 * @param {string} gameInfo.teamAbbrev - Player's team abbreviation
 * @param {string} gameInfo.opponentAbbrev - Opponent team abbreviation
 */
export async function getPlayerOdds(playerId, playerName, gameInfo = {}) {
  if (!playerName) {
    throw new Error('Player name is required to fetch odds');
  }

  if (!THE_ODDS_API_KEY) {
    throw new Error('THE_ODDS_API_KEY not configured');
  }

  console.log(`🎲 Fetching odds from The Odds API for player: ${playerName}`);
  console.log(`🔑 Using API Key: ${THE_ODDS_API_KEY.substring(0, 8)}...`);

  try {
    // STEP 1: Get all NBA events to find the matching event ID
    const eventsUrl = `${THE_ODDS_API_BASE}/sports/basketball_nba/events`;
    console.log(`📤 Step 1: Fetching events from: ${eventsUrl}`);
    
    const eventsResponse = await axios.get(eventsUrl, {
      params: {
        apiKey: THE_ODDS_API_KEY
      },
      timeout: 15000,
      headers: {
        Accept: 'application/json'
      }
    });

    if (!eventsResponse.data || !Array.isArray(eventsResponse.data)) {
      throw new Error('Invalid events response from The Odds API');
    }

    const events = eventsResponse.data;
    console.log(`📊 Found ${events.length} NBA events`);

    // Find the matching event (if we have team info)
    let targetEventId = null;
    if (gameInfo.teamAbbrev && gameInfo.opponentAbbrev) {
      console.log(`🔍 Looking for event matching: ${gameInfo.teamAbbrev} vs ${gameInfo.opponentAbbrev}`);
      for (const event of events) {
        console.log(`   Checking event: ${event.home_team} vs ${event.away_team} (ID: ${event.id})`);
        if (matchesEvent(event, gameInfo.teamAbbrev, gameInfo.opponentAbbrev)) {
          targetEventId = event.id;
          console.log(`✅ Found matching event: ${event.id} (${event.home_team} vs ${event.away_team})`);
          break;
        }
      }
      if (!targetEventId) {
        console.log(`⚠️ No exact match found. Available events:`);
        events.slice(0, 5).forEach(e => {
          console.log(`   - ${e.home_team} vs ${e.away_team} (ID: ${e.id})`);
        });
      }
    }

    // If no match found, use the first upcoming event
    if (!targetEventId && events.length > 0) {
      targetEventId = events[0].id;
      console.log(`⚠️ No matching event found, using first event: ${targetEventId}`);
    }

    if (!targetEventId) {
      throw new Error('No NBA events found');
    }

    // STEP 2: Get odds for the specific event with player_points market
    // Use the correct endpoint format: /v4/sports/{sport}/events/{eventId}/odds
    const oddsUrl = `${THE_ODDS_API_BASE}/sports/basketball_nba/events/${targetEventId}/odds`;
    console.log(`📤 Step 2: Fetching odds from: ${oddsUrl}`);
    
    const oddsResponse = await axios.get(oddsUrl, {
      params: {
        apiKey: THE_ODDS_API_KEY,
        regions: 'us',
        markets: 'player_points',
        oddsFormat: 'american'
      },
      timeout: 15000,
      headers: {
        Accept: 'application/json'
      }
    });

    console.log(`📥 Odds response status: ${oddsResponse.status}`);

    if (!oddsResponse.data) {
      throw new Error('Empty odds response from The Odds API');
    }

    // Log the response structure for debugging
    console.log(`📋 Response structure:`, JSON.stringify(oddsResponse.data).substring(0, 500));
    if (oddsResponse.data.bookmakers) {
      console.log(`📊 Found ${oddsResponse.data.bookmakers.length} bookmakers in response`);
    } else {
      console.log(`⚠️ No 'bookmakers' key found. Response keys:`, Object.keys(oddsResponse.data));
    }

    const playerLine = parseTheOddsApiResponse(
      oddsResponse.data,
      playerName,
      preferredBookmakers
    );

    if (!playerLine || !playerLine.line) {
      throw new Error(`No points line found for ${playerName} in API response`);
    }

    console.log(`✅ Successfully found odds: ${playerLine.line} from ${playerLine.bookmaker}`);
    return playerLine;
  } catch (error) {
    console.error('❌ Error fetching odds:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data).substring(0, 200));
    }

    // Throw error - no fallbacks
    throw new Error(
      `Failed to fetch odds from The Odds API: ${
        error.response?.data?.message || error.message
      }`
    );
  }
}

/**
 * Parse The Odds API response to find player line
 * Prioritizes major sportsbooks like DraftKings, FanDuel, etc.
 */
function parseTheOddsApiResponse(data, playerName, preferredBookmakers = []) {
  if (!data || !playerName) {
    return null;
  }

  const searchName = normalize(playerName);
  const nameParts = searchName.split(' ').filter(Boolean);

  console.log(`🔍 Parsing The Odds API response for: "${playerName}"`);

  // The Odds API returns an object with bookmakers array
  const bookmakers = data.bookmakers || [];
  console.log(`📊 Found ${bookmakers.length} bookmakers`);

  const foundLines = [];

  for (const bookmaker of bookmakers) {
    const bookmakerKey = bookmaker.key || '';
    const bookmakerTitle = bookmaker.title || bookmakerKey;
    const markets = bookmaker.markets || [];

    // Find player_points market
    for (const market of markets) {
      if (market.key !== 'player_points') continue;

      const outcomes = market.outcomes || [];
      
      // Each outcome represents a player's over/under line
      // The Odds API structure: name="Over"/"Under", description="Player Name", point=29.5
      for (const outcome of outcomes) {
        // Check if this outcome matches our player
        // Player name is in the description field, name is "Over" or "Under"
        const outcomeDescription = normalize(outcome.description || '');
        const outcomePlayerName = normalize(outcome.player_name || outcome.description || '');
        
        // Try to match player name from description
        let matches = false;
        if (nameParts.length >= 2) {
          const firstMatch = outcomeDescription.includes(nameParts[0]) || outcomePlayerName.includes(nameParts[0]);
          const lastMatch = outcomeDescription.includes(nameParts[nameParts.length - 1]) || outcomePlayerName.includes(nameParts[nameParts.length - 1]);
          matches = firstMatch && lastMatch;
        } else if (nameParts.length === 1) {
          matches = outcomeDescription.includes(nameParts[0]) || outcomePlayerName.includes(nameParts[0]);
        }

        if (matches) {
          // Extract the line (point value) - The Odds API uses "point" field
          const pointValue = outcome.point;
          if (pointValue != null) {
            const line = parseFloat(pointValue);
            if (!isNaN(line) && line > 0) {
              const priority = preferredBookmakers.findIndex((p) =>
                bookmakerKey.toLowerCase().includes(p) || bookmakerTitle.toLowerCase().includes(p)
              );

              // Find the opposing outcome (over/under pair)
              // The Odds API structure: name="Over" or "Under", description="Player Name", point=29.5
              let overOdds = -110;
              let underOdds = -110;
              
              // Check if this is an "over" or "under" outcome
              const outcomeName = (outcome.name || '').toLowerCase();
              if (outcomeName === 'over') {
                overOdds = outcome.price || -110;
                // Find corresponding under outcome with same point value
                for (const otherOutcome of outcomes) {
                  const otherName = (otherOutcome.name || '').toLowerCase();
                  const otherPoint = parseFloat(otherOutcome.point);
                  const otherDesc = normalize(otherOutcome.description || '');
                  // Match same player and same point value
                  if (otherName === 'under' && !isNaN(otherPoint) && Math.abs(otherPoint - line) < 0.1 && 
                      (otherDesc === outcomeDescription || otherDesc.includes(nameParts[0]))) {
                    underOdds = otherOutcome.price || -110;
                    break;
                  }
                }
              } else if (outcomeName === 'under') {
                underOdds = outcome.price || -110;
                // Find corresponding over outcome with same point value
                for (const otherOutcome of outcomes) {
                  const otherName = (otherOutcome.name || '').toLowerCase();
                  const otherPoint = parseFloat(otherOutcome.point);
                  const otherDesc = normalize(otherOutcome.description || '');
                  // Match same player and same point value
                  if (otherName === 'over' && !isNaN(otherPoint) && Math.abs(otherPoint - line) < 0.1 &&
                      (otherDesc === outcomeDescription || otherDesc.includes(nameParts[0]))) {
                    overOdds = otherOutcome.price || -110;
                    break;
                  }
                }
              } else {
                // If not clear, use the price for both
                overOdds = outcome.price || -110;
                underOdds = outcome.price || -110;
              }

              foundLines.push({
                line: line,
                over_odds: overOdds,
                under_odds: underOdds,
                bookmaker: bookmakerTitle,
                priority: priority === -1 ? 999 : priority,
                last_update: new Date().toISOString()
              });
            }
          }
        }
      }
    }
  }

  if (foundLines.length > 0) {
    // Remove duplicates and sort by priority
    const uniqueLines = [];
    const seen = new Set();
    
    for (const line of foundLines) {
      const key = `${line.bookmaker}_${line.line}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueLines.push(line);
      }
    }

    uniqueLines.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return 0;
    });

    const bestLine = uniqueLines[0];
    console.log(
      `✅ Found ${uniqueLines.length} line(s), using best: ${bestLine.line} from ${bestLine.bookmaker}`
    );

    return {
      player: playerName,
      line: bestLine.line,
      over_odds: bestLine.over_odds,
      under_odds: bestLine.under_odds,
      bookmaker: bestLine.bookmaker,
      last_update: bestLine.last_update,
      source: 'theoddsapi'
    };
  }

  console.log(`❌ No points line found for ${playerName}`);
  return null;
}
