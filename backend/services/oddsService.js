import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const THE_ODDS_API_KEY = process.env.THE_ODDS_API_KEY || process.env.ODDS_API_KEY;
const THE_ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

// Prioritize FanDuel and BetMGM over DraftKings (DraftKings sometimes has incorrect data)
const preferredBookmakers = [
  'fanduel',      // Primary: FanDuel is generally reliable
  'betmgm',       // Secondary: BetMGM is also reliable
  'caesars',      // Tertiary: Caesars
  'pointsbet',    // Fourth: PointsBet
  'barstool',     // Fifth: Barstool
  'betrivers',    // Sixth: BetRivers
  'wynnbet',      // Seventh: WynnBet
  'unibet',       // Eighth: Unibet
  'foxbet',       // Ninth: FoxBet
  'draftkings'    // Last: DraftKings (moved to end due to data quality issues)
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

    // STEP 2: Get odds for the specific event with ALL player prop markets
    // According to The Odds API v4 docs: https://the-odds-api.com/liveapi/guides/v4/#host
    // Endpoint: GET /v4/sports/{sport}/events/{eventId}/odds
    // Parameters: markets=player_points,player_assists,player_rebounds,player_steals,player_blocks,player_threes
    // Request multiple markets to get all available props for the player
    const oddsUrl = `${THE_ODDS_API_BASE}/sports/basketball_nba/events/${targetEventId}/odds`;
    console.log(`📤 Step 2: Fetching odds from: ${oddsUrl}`);
    console.log(`   📋 Requesting ALL player prop markets (points, assists, rebounds, steals, blocks, threes)`);
    console.log(`   📅 Event ID: ${targetEventId}`);
    
    // Request multiple player prop markets including combined props
    // The Odds API markets parameter accepts comma-separated values
    // Reference: https://the-odds-api.com/liveapi/guides/v4/#get-event-odds
    const oddsFormat = 'american'; // Using American format per docs
    const playerPropMarkets = [
      'player_points',
      'player_assists',
      'player_rebounds',
      'player_steals',
      'player_blocks',
      'player_threes',
      'player_points_rebounds',  // Combined: Points + Rebounds
      'player_points_assists'    // Combined: Points + Assists
    ].join(',');
    
    const oddsResponse = await axios.get(oddsUrl, {
      params: {
        apiKey: THE_ODDS_API_KEY,
        regions: 'us',
        markets: playerPropMarkets, // Multiple markets comma-separated
        oddsFormat: oddsFormat // American odds format (-110, +120, etc.)
      },
      timeout: 15000,
      headers: {
        Accept: 'application/json'
      }
    });
    
    // Verify the request was correct per documentation
    console.log(`   🔍 Requested markets: ${playerPropMarkets}`);
    console.log(`   📋 Request parameters: regions=us, markets=${playerPropMarkets}, oddsFormat=american`);

    console.log(`📥 Odds response status: ${oddsResponse.status}`);

    if (!oddsResponse.data) {
      throw new Error('Empty odds response from The Odds API');
    }

    // Verify response structure matches The Odds API v4 documentation
    // Expected structure per docs: { id, sport_key, commence_time, home_team, away_team, bookmakers: [...] }
    // Reference: https://the-odds-api.com/liveapi/guides/v4/#get-event-odds
    console.log(`📋 Response structure verification:`);
    console.log(`   - Event ID: ${oddsResponse.data.id || 'missing'}`);
    console.log(`   - Sport: ${oddsResponse.data.sport_key || 'missing'}`);
    console.log(`   - Commence time: ${oddsResponse.data.commence_time || 'missing'}`);
    console.log(`   - Teams: ${oddsResponse.data.away_team || '?'} @ ${oddsResponse.data.home_team || '?'}`);
    
    if (oddsResponse.data.bookmakers) {
      console.log(`📊 Found ${oddsResponse.data.bookmakers.length} bookmakers in response`);
      
      // Log all markets found across all bookmakers to verify we're only getting player_points
      const allMarkets = new Set();
      oddsResponse.data.bookmakers.forEach(bm => {
        (bm.markets || []).forEach(m => {
          allMarkets.add(m.key || m.name || 'unknown');
        });
      });
      console.log(`🔍 All market types found in response:`, Array.from(allMarkets).join(', '));
      if (allMarkets.size > 1 || !allMarkets.has('player_points')) {
        console.log(`⚠️  WARNING: Multiple market types found or 'player_points' missing!`);
        console.log(`   Expected: Only 'player_points', Found: ${Array.from(allMarkets).join(', ')}`);
      } else {
        console.log(`✅ Verified: Only 'player_points' markets found (as expected per API docs)`);
      }
    } else {
      console.log(`⚠️ No 'bookmakers' key found. Response keys:`, Object.keys(oddsResponse.data));
      console.log(`   Full response sample:`, JSON.stringify(oddsResponse.data).substring(0, 500));
    }

    // Parse all prop types from the response
    const allProps = parseAllPlayerProps(
      oddsResponse.data,
      playerName,
      preferredBookmakers
    );

    if (!allProps || Object.keys(allProps).length === 0) {
      // Log the full response for debugging
      console.log(`⚠️ No props found for ${playerName}. Returning empty props object.`);
      console.log(`   Full response structure:`, JSON.stringify(oddsResponse.data, null, 2).substring(0, 1000));
      // Return empty object instead of throwing - let the frontend handle it gracefully
      return {};
    }

    // Log what we found
    console.log(`✅ Successfully found ${Object.keys(allProps).length} prop type(s):`, Object.keys(allProps).join(', '));
    console.log(`📊 All props details:`, JSON.stringify(allProps, null, 2));
    
    return allProps;
  } catch (error) {
    console.error('❌ Error fetching odds:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data).substring(0, 200));
    }

    // Return empty object instead of throwing - let the frontend handle gracefully
    console.log(`⚠️ Returning empty props due to error`);
    return {};
  }
}

/**
 * Parse The Odds API response to find ALL player props
 * Returns an object with prop types as keys (points, assists, rebounds, etc.)
 */
function parseAllPlayerProps(data, playerName, preferredBookmakers = []) {
  if (!data || !playerName) {
    return null;
  }

  const allProps = {};
  const validMarkets = [
    'player_points',
    'player_assists',
    'player_rebounds',
    'player_steals',
    'player_blocks',
    'player_threes',
    'player_points_rebounds',  // Combined: Points + Rebounds
    'player_points_assists'    // Combined: Points + Assists
  ];

  // First, log all markets found in the response to see what's available
  const allMarketsInResponse = new Set();
  if (data && data.bookmakers) {
    data.bookmakers.forEach(bm => {
      (bm.markets || []).forEach(m => {
        allMarketsInResponse.add(m.key || 'unknown');
      });
    });
  }
  console.log(`📊 All market keys found in API response:`, Array.from(allMarketsInResponse).join(', '));

  // Parse each market type
  for (const marketType of validMarkets) {
    console.log(`🔍 Attempting to parse ${marketType}...`);
    const prop = parseTheOddsApiResponse(data, playerName, preferredBookmakers, marketType);
    if (prop && prop.line != null) {
      // Convert market key to friendly name
      let propName = marketType.replace('player_', '');
      // Handle combined props with better naming
      if (propName === 'points_rebounds') {
        propName = 'points_rebounds'; // Keep as is for now
      } else if (propName === 'points_assists') {
        propName = 'points_assists'; // Keep as is for now
      }
      
      // Validation: Ensure single props are less than combined props
      if (propName === 'rebounds' && allProps.points_rebounds) {
        const reboundsLine = prop.line;
        const pointsReboundsLine = allProps.points_rebounds.line;
        if (reboundsLine >= pointsReboundsLine) {
          console.log(`⚠️  WARNING: Rebounds line (${reboundsLine}) >= Points+Rebounds line (${pointsReboundsLine}). This seems incorrect, rejecting rebounds prop.`);
          continue; // Skip this prop as it's likely incorrect
        }
      }
      if (propName === 'assists' && allProps.points_assists) {
        const assistsLine = prop.line;
        const pointsAssistsLine = allProps.points_assists.line;
        if (assistsLine >= pointsAssistsLine) {
          console.log(`⚠️  WARNING: Assists line (${assistsLine}) >= Points+Assists line (${pointsAssistsLine}). This seems incorrect, rejecting assists prop.`);
          continue; // Skip this prop as it's likely incorrect
        }
      }
      if (propName === 'points_rebounds' && allProps.rebounds) {
        const reboundsLine = allProps.rebounds.line;
        const pointsReboundsLine = prop.line;
        if (reboundsLine >= pointsReboundsLine) {
          console.log(`⚠️  WARNING: Rebounds line (${reboundsLine}) >= Points+Rebounds line (${pointsReboundsLine}). Removing incorrect rebounds prop.`);
          delete allProps.rebounds; // Remove the incorrect rebounds prop
        }
      }
      if (propName === 'points_assists' && allProps.assists) {
        const assistsLine = allProps.assists.line;
        const pointsAssistsLine = prop.line;
        if (assistsLine >= pointsAssistsLine) {
          console.log(`⚠️  WARNING: Assists line (${assistsLine}) >= Points+Assists line (${pointsAssistsLine}). Removing incorrect assists prop.`);
          delete allProps.assists; // Remove the incorrect assists prop
        }
      }
      
      allProps[propName] = prop;
      console.log(`✅ Successfully parsed ${marketType} → ${propName} with line ${prop.line}`);
    } else {
      console.log(`❌ Failed to parse ${marketType} - prop:`, prop);
    }
  }
  
  console.log(`📊 Final allProps keys:`, Object.keys(allProps));

  return Object.keys(allProps).length > 0 ? allProps : null;
}

/**
 * Parse The Odds API response to find player line for a specific market
 * Prioritizes major sportsbooks like DraftKings, FanDuel, etc.
 * @param {string} marketType - The market type to parse (e.g., 'player_points', 'player_assists')
 */
function parseTheOddsApiResponse(data, playerName, preferredBookmakers = [], marketType = 'player_points') {
  if (!data || !playerName) {
    return null;
  }

  const searchName = normalize(playerName);
  const nameParts = searchName.split(' ').filter(Boolean);

  console.log(`🔍 Parsing The Odds API response for: "${playerName}"`);
  console.log(`   📋 Normalized search name: "${searchName}"`);
  console.log(`   📋 Name parts: [${nameParts.join(', ')}]`);

  // The Odds API returns an object with bookmakers array
  const bookmakers = data.bookmakers || [];
  console.log(`📊 Found ${bookmakers.length} bookmakers`);

  const foundLines = [];

  for (const bookmaker of bookmakers) {
    const bookmakerKey = bookmaker.key || '';
    const bookmakerTitle = bookmaker.title || bookmakerKey;
    const markets = bookmaker.markets || [];
    
    // Log all markets for debugging
    if (markets.length > 0) {
      console.log(`   📊 Bookmaker ${bookmakerTitle} has ${markets.length} market(s):`, 
        markets.map(m => `${m.key}${m.name ? ` (${m.name})` : ''}`).join(', '));
    }

    // Find the specific market type we're looking for
    for (const market of markets) {
      const marketKey = market.key || '';
      const marketKeyLower = marketKey.toLowerCase();
      
      // Check if this is the market type we want
      // The Odds API returns market keys like "player_points", "player_assists", etc.
      const marketTypeLower = marketType.toLowerCase();
      const propType = marketTypeLower.replace('player_', '');
      
      // Match if:
      // 1. Exact match: "player_points" === "player_points"
      // 2. For combined props, check for both parts (and exclude single props)
      // 3. For single props, check prop type but EXCLUDE combined props
      let matches = false;
      if (marketKeyLower === marketTypeLower) {
        matches = true;
        console.log(`   ✅ Exact match: "${marketKey}" === "${marketType}"`);
      } else if (marketType === 'player_points_rebounds') {
        // Combined prop: must contain both "points" and "rebounds", but NOT be a single prop
        matches = marketKeyLower.includes('points') && 
                  marketKeyLower.includes('rebounds') &&
                  !marketKeyLower.match(/^player_(points|rebounds)$/); // Exclude single props
        if (matches) {
          console.log(`   ✅ Combined prop match: "${marketKey}" contains both "points" and "rebounds"`);
        }
      } else if (marketType === 'player_points_assists') {
        // Combined prop: must contain both "points" and "assists", but NOT be a single prop
        matches = marketKeyLower.includes('points') && 
                  marketKeyLower.includes('assists') &&
                  !marketKeyLower.match(/^player_(points|assists)$/); // Exclude single props
        if (matches) {
          console.log(`   ✅ Combined prop match: "${marketKey}" contains both "points" and "assists"`);
        }
      } else {
        // For single props (points, assists, rebounds, etc.), check prop type
        // BUT exclude combined props (must NOT contain other prop types)
        if (marketKeyLower.includes(propType)) {
          // Exclude combined props - check if it contains other prop types
          const isCombinedProp = 
            (propType === 'points' && (marketKeyLower.includes('rebounds') || marketKeyLower.includes('assists'))) ||
            (propType === 'rebounds' && (marketKeyLower.includes('points') || marketKeyLower.includes('assists'))) ||
            (propType === 'assists' && (marketKeyLower.includes('points') || marketKeyLower.includes('rebounds'))) ||
            marketKeyLower.includes('+') ||
            marketKeyLower.includes('_and_') ||
            marketKeyLower.includes('_r_') ||
            marketKeyLower.includes('_a_');
          
          if (!isCombinedProp) {
            matches = true;
            console.log(`   ✅ Single prop match: "${marketKey}" contains "${propType}" (not a combined prop)`);
          } else {
            console.log(`   ❌ Rejecting "${marketKey}" - appears to be a combined prop, not single "${propType}"`);
          }
        }
      }
      
      if (!matches) {
        console.log(`   ❌ No match: "${marketKey}" for "${marketType}" (propType: "${propType}")`);
        continue; // Skip markets we're not interested in
      }
      
      // For points market, apply strict filtering to avoid PRA
      if (marketType === 'player_points') {
        // Additional safety: Check for any suspicious patterns in the key
        if (marketKeyLower.includes('rebounds') || 
            marketKeyLower.includes('assists') || 
            marketKeyLower.includes('pra') ||
            marketKeyLower.includes('+') ||
            marketKeyLower.includes('and') ||
            marketKeyLower.includes('&') ||
            marketKeyLower.includes('_r_') ||
            marketKeyLower.includes('_a_')) {
          console.log(`   ❌ REJECTING market: "${marketKey}" (contains suspicious pattern)`);
          continue;
        }
        
        // Double-check: reject if market name suggests it's not just points
        const marketName = (market.name || '').toLowerCase();
        if (marketName && (
            marketName.includes('pra') || 
            marketName.includes('points+rebounds+assists') ||
            marketName.includes('points rebounds assists') ||
            marketName.includes('points & rebounds') ||
            marketName.includes('points and rebounds'))) {
          console.log(`   ❌ REJECTING market: "${marketKey}" with suspicious name: "${marketName}"`);
          continue;
        }
      }
      
      console.log(`   ✅ ACCEPTING market: "${marketKey}" for ${marketType}`);

      const outcomes = market.outcomes || [];
      
      // Each outcome represents a player's over/under line
      // The Odds API structure: name="Over"/"Under", description="Player Name", point=29.5
      for (const outcome of outcomes) {
        // Check if this outcome matches our player
        // Player name is in the description field, name is "Over" or "Under"
        const outcomeDescription = normalize(outcome.description || '');
        const outcomePlayerName = normalize(outcome.player_name || outcome.description || '');
        
        // STRICT player name matching - must match both first and last name
        // According to The Odds API docs: description="Player Name", so we need exact match
        let matches = false;
        const searchNameNormalized = normalize(playerName);
        const outcomeDescNormalized = normalize(outcome.description || '');
        const outcomePlayerNameNormalized = normalize(outcome.player_name || '');
        
        // Try multiple matching strategies for robustness
        if (nameParts.length >= 2) {
          const firstName = nameParts[0];
          const lastName = nameParts[nameParts.length - 1];
          
          // Strategy 1: Both first and last name must be present
          const hasFirstName = outcomeDescNormalized.includes(firstName) || outcomePlayerNameNormalized.includes(firstName);
          const hasLastName = outcomeDescNormalized.includes(lastName) || outcomePlayerNameNormalized.includes(lastName);
          
          // Strategy 2: Full normalized name match (most reliable)
          const fullNameMatch = outcomeDescNormalized === searchNameNormalized || 
                               outcomePlayerNameNormalized === searchNameNormalized;
          
          // Strategy 3: Check if description starts with player name
          const startsWithMatch = outcomeDescNormalized.startsWith(searchNameNormalized) ||
                                 outcomePlayerNameNormalized.startsWith(searchNameNormalized);
          
          matches = fullNameMatch || startsWithMatch || (hasFirstName && hasLastName);
          
          // Log matching attempt for debugging
          if (!matches) {
            console.log(`   🔍 Name mismatch: Looking for "${playerName}" (normalized: "${searchNameNormalized}"), found "${outcome.description}" (normalized: "${outcomeDescNormalized}")`);
          }
        } else if (nameParts.length === 1) {
          // Single name - must be exact match
          matches = outcomeDescNormalized === searchNameNormalized || 
                   outcomePlayerNameNormalized === searchNameNormalized ||
                   outcomeDescNormalized.includes(nameParts[0]) || 
                   outcomePlayerNameNormalized.includes(nameParts[0]);
        }

        if (matches) {
          // Extract the line (point value) - The Odds API uses "point" field
          const pointValue = outcome.point;
          if (pointValue != null) {
            const line = parseFloat(pointValue);
            
            // Sanity checks based on prop type
            let isValidLine = false;
            if (marketType === 'player_points') {
              // Points: 5-60 is reasonable
              if (line > 0 && line <= 60) {
                // Additional validation: Check outcome description for any PRA indicators
                const descLower = outcomeDescription.toLowerCase();
                if (descLower.includes('pra') || 
                    descLower.includes('points+rebounds+assists') ||
                    descLower.includes('points rebounds assists')) {
                  console.log(`   ⚠️  Outcome description suggests PRA: "${outcomeDescription}", skipping`);
                  continue;
                }
                isValidLine = true;
              }
            } else if (marketType === 'player_assists') {
              // Assists: 0-20 is reasonable
              isValidLine = line > 0 && line <= 20;
            } else if (marketType === 'player_rebounds') {
              // Rebounds: 0-20 is reasonable
              isValidLine = line > 0 && line <= 20;
            } else if (marketType === 'player_steals') {
              // Steals: 0-5 is reasonable
              isValidLine = line > 0 && line <= 5;
            } else if (marketType === 'player_blocks') {
              // Blocks: 0-5 is reasonable
              isValidLine = line > 0 && line <= 5;
            } else if (marketType === 'player_threes') {
              // Threes: 0-10 is reasonable
              isValidLine = line > 0 && line <= 10;
            } else if (marketType === 'player_points_rebounds') {
              // Points + Rebounds: 5-50 is reasonable
              isValidLine = line > 0 && line <= 50;
            } else if (marketType === 'player_points_assists') {
              // Points + Assists: 5-50 is reasonable
              isValidLine = line > 0 && line <= 50;
            } else {
              // Default: any positive number
              isValidLine = line > 0;
            }
            
            if (isValidLine) {
              // Log the full outcome for debugging - verify it matches The Odds API structure
              // Per docs: outcome.name="Over"/"Under", outcome.description="Player Name", outcome.point=line value
              console.log(`   ✅ Found ${marketType} line: ${line} for ${playerName} from ${bookmakerTitle}`);
              console.log(`      Outcome structure (per API docs):`);
              console.log(`        - name: "${outcome.name}" (should be "Over" or "Under")`);
              console.log(`        - description: "${outcome.description}" (should be player name)`);
              console.log(`        - point: ${outcome.point} (the betting line)`);
              console.log(`        - price: ${outcome.price} (odds in american format)`);
              
              // Verify the outcome structure matches documentation exactly
              if (outcome.name !== 'Over' && outcome.name !== 'Under') {
                console.log(`   ⚠️  WARNING: Unexpected outcome name "${outcome.name}", expected "Over" or "Under"`);
              }
              
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

    // Log all available lines for debugging
    if (uniqueLines.length > 1) {
      console.log(`   📊 Available lines from different bookmakers:`);
      uniqueLines.slice(0, 5).forEach((line, idx) => {
        console.log(`      ${idx + 1}. ${line.line} from ${line.bookmaker} (priority: ${line.priority})`);
      });
    }

    let bestLine = uniqueLines[0];
    
    // Additional validation for points: Check if line seems reasonable
    // Very low lines (< 8) might be incorrect (e.g., 10.5 for Zach LaVine is clearly wrong)
    if (marketType === 'player_points' && bestLine.line < 8) {
      console.log(`   ⚠️  WARNING: Suspiciously low line (${bestLine.line}) from ${bestLine.bookmaker} - might be incorrect data`);
      // Try to find a more reasonable line from other bookmakers
      const alternativeLine = uniqueLines.find(l => l.line >= 8 && l.line <= 60);
      if (alternativeLine) {
        console.log(`   ✅ Using alternative line: ${alternativeLine.line} from ${alternativeLine.bookmaker} instead`);
        bestLine = alternativeLine;
        // Return early with the alternative line
        return {
          player: playerName,
          line: bestLine.line,
          over_odds: bestLine.over_odds,
          under_odds: bestLine.under_odds,
          bookmaker: bestLine.bookmaker,
          last_update: bestLine.last_update,
          source: 'theoddsapi',
          market: marketType,
          warning: `Original line ${uniqueLines[0].line} from ${uniqueLines[0].bookmaker} seemed incorrect, using ${bestLine.line} from ${bestLine.bookmaker}`
        };
      } else {
        console.log(`   ⚠️  No alternative line found, using original: ${bestLine.line}`);
      }
    }
    
    console.log(
      `✅ Found ${uniqueLines.length} line(s) for ${marketType}, using best: ${bestLine.line} from ${bestLine.bookmaker} (priority: ${bestLine.priority})`
    );

    return {
      player: playerName,
      line: bestLine.line,
      over_odds: bestLine.over_odds,
      under_odds: bestLine.under_odds,
      bookmaker: bestLine.bookmaker,
      last_update: bestLine.last_update,
      source: 'theoddsapi',
      market: marketType
    };
  }

  console.log(`❌ No ${marketType} line found for ${playerName}`);
  return null;
}
