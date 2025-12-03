import OpenAI from 'openai';
import dotenv from 'dotenv';
import { storePrediction } from './predictionTrackingService.js';

dotenv.config();

// Initialize OpenAI client (lazy initialization)
let openai = null;

function getOpenAIClient() {
  if (!openai) {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required. Please set it in your .env file.');
    }
    openai = new OpenAI({
      apiKey: OPENAI_API_KEY
    });
  }
  return openai;
}

/**
 * Prop type mapping to standardized format
 */
const PROP_TYPE_MAP = {
  'points': 'PTS',
  'rebounds': 'REB',
  'assists': 'AST',
  'steals': 'STL',
  'blocks': 'BLK',
  'threes': '3PM',
  'threes_made': '3PM',
  'turnovers': 'TO',
  'points_rebounds': 'PR',  // Points + Rebounds
  'points_assists': 'PA',   // Points + Assists
  'rebounds_assists': 'RA', // Rebounds + Assists
  'points_rebounds_assists': 'PRA' // Points + Rebounds + Assists
};

/**
 * Get the stat value for a specific prop type from a game
 */
export function getPropValue(game, propType) {
  switch (propType) {
    case 'points':
      return typeof game.points === 'number' ? game.points : parseFloat(game.points) || 0;
    case 'assists':
      return typeof game.assists === 'number' ? game.assists : parseFloat(game.assists) || 0;
    case 'rebounds':
      return typeof game.rebounds === 'number' ? game.rebounds : parseFloat(game.rebounds) || 0;
    case 'steals':
      return typeof game.steals === 'number' ? game.steals : parseFloat(game.steals) || 0;
    case 'blocks':
      return typeof game.blocks === 'number' ? game.blocks : parseFloat(game.blocks) || 0;
    case 'threes':
    case 'threes_made':
      return typeof game.threes === 'number' ? game.threes : 
             typeof game.threes_made === 'number' ? game.threes_made :
             parseFloat(game.threes || game.threes_made) || 0;
    case 'turnovers':
      return typeof game.turnovers === 'number' ? game.turnovers : parseFloat(game.turnovers) || 0;
    case 'points_rebounds':
      const pts1 = typeof game.points === 'number' ? game.points : parseFloat(game.points) || 0;
      const reb1 = typeof game.rebounds === 'number' ? game.rebounds : parseFloat(game.rebounds) || 0;
      return pts1 + reb1;
    case 'points_assists':
      const pts2 = typeof game.points === 'number' ? game.points : parseFloat(game.points) || 0;
      const ast1 = typeof game.assists === 'number' ? game.assists : parseFloat(game.assists) || 0;
      return pts2 + ast1;
    case 'rebounds_assists':
      const reb2 = typeof game.rebounds === 'number' ? game.rebounds : parseFloat(game.rebounds) || 0;
      const ast2 = typeof game.assists === 'number' ? game.assists : parseFloat(game.assists) || 0;
      return reb2 + ast2;
    case 'points_rebounds_assists':
      const pts3 = typeof game.points === 'number' ? game.points : parseFloat(game.points) || 0;
      const reb3 = typeof game.rebounds === 'number' ? game.rebounds : parseFloat(game.rebounds) || 0;
      const ast3 = typeof game.assists === 'number' ? game.assists : parseFloat(game.assists) || 0;
      return pts3 + reb3 + ast3;
    default:
      return 0;
  }
}

/**
 * Parse minutes from various formats
 */
function parseMinutes(mins) {
  if (!mins || mins === '0' || mins === 0) return null;
  if (typeof mins === 'number') return mins;
  if (typeof mins === 'string') {
    if (mins.includes(':')) {
      const parts = mins.split(':');
      const minutes = parseInt(parts[0]) || 0;
      const seconds = parseInt(parts[1]) || 0;
      return minutes + (seconds / 60);
    }
    const parsed = parseFloat(mins);
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Get player injury status from injury data
 */
function getPlayerInjuryStatus(injuryData, playerName) {
  if (!injuryData || !injuryData.playerTeamInjuries) {
    return { status: 'active', description: '', minutesReduction: 0 };
  }

  const playerInjury = injuryData.playerTeamInjuries.find(
    inj => inj.playerName && playerName && 
    inj.playerName.toLowerCase().includes(playerName.toLowerCase().split(' ').pop())
  );

  if (!playerInjury) {
    return { status: 'active', description: '', minutesReduction: 0 };
  }

  const statusLower = (playerInjury.status || '').toLowerCase();
  const description = (playerInjury.description || playerInjury.comment || '').toLowerCase();

  let status = 'active';
  let minutesReduction = 0;

  if (statusLower.includes('out') || statusLower.includes('doubtful')) {
    status = 'out';
    minutesReduction = 100;
  } else if (statusLower.includes('questionable')) {
    if (description.includes('expected to play') || description.includes('probable') || description.includes('likely to play')) {
      status = 'questionable';
      minutesReduction = 5;
    } else {
      status = 'questionable';
      minutesReduction = 10;
    }
  } else if (statusLower.includes('limited') || description.includes('minute restriction') || description.includes('limited minutes')) {
    status = 'limited';
    const minutesMatch = description.match(/(\d+)\s*min/i);
    if (minutesMatch) {
      const restrictedMins = parseInt(minutesMatch[1]);
      minutesReduction = Math.max(10, Math.min(20, 100 - (restrictedMins / 35) * 100));
    } else {
      minutesReduction = 15;
    }
  } else {
    status = 'active';
    minutesReduction = 0;
  }

  return { status, description: playerInjury.description || playerInjury.comment || '', minutesReduction };
}

/**
 * Format opponent injuries as comma-separated list with statuses
 * Also detects missing key defenders and adds contextual notes
 */
function formatOpponentInjuries(opponentInjuries, propType) {
  if (!opponentInjuries || opponentInjuries.length === 0) {
    return 'none';
  }

  // Format as "Player Name (status), Player Name (status)"
  const injuryList = opponentInjuries.map(inj => {
    const name = inj.playerName || 'Unknown';
    const status = (inj.status || 'out').toLowerCase();
    // Normalize status for display
    let displayStatus = 'out';
    if (status.includes('questionable')) {
      displayStatus = 'questionable';
    } else if (status.includes('doubtful')) {
      displayStatus = 'doubtful';
    } else if (status.includes('active') || status.includes('probable')) {
      displayStatus = 'active';
    }
    return `${name} (${displayStatus})`;
  });

  // Detect missing key defenders (prop-specific)
  const contextualNotes = [];
  const highImpactInjuries = opponentInjuries.filter(inj => (inj.impactScore || 0) >= 70);
  
  // For REBOUNDS: Check for missing rim protector/bigs
  if (propType === 'rebounds' || propType === 'points_rebounds' || propType === 'rebounds_assists' || propType === 'points_rebounds_assists') {
    const missingRimProtector = opponentInjuries.some(inj => {
      const pos = (inj.position || '').toUpperCase();
      return (pos === 'C' || pos.includes('CENTER') || pos === 'PF') && (inj.impactScore || 0) >= 70;
    });
    if (missingRimProtector) {
      contextualNotes.push('missing rim protector');
    }
  }

  // For ASSISTS: Check for missing PG defenders
  if (propType === 'assists' || propType === 'points_assists' || propType === 'rebounds_assists' || propType === 'points_rebounds_assists') {
    const hasStartingPG = opponentInjuries.some(inj => {
      const pos = (inj.position || '').toUpperCase();
      return pos === 'PG' && (inj.impactScore || 0) >= 70;
    });
    if (hasStartingPG) {
      contextualNotes.push('missing starting PG');
    }
  }

  // For POINTS/3PM: Check for missing perimeter defenders
  if (propType === 'points' || propType === 'threes' || propType === 'threes_made' || propType === 'points_assists' || propType === 'points_rebounds' || propType === 'points_rebounds_assists') {
    const hasTopPerimeterDefender = opponentInjuries.some(inj => {
      const pos = (inj.position || '').toUpperCase();
      return (pos === 'SG' || pos === 'SF' || pos.includes('GUARD') || pos.includes('FORWARD')) && 
             (inj.impactScore || 0) >= 80;
    });
    if (hasTopPerimeterDefender) {
      contextualNotes.push('missing top perimeter defender');
    }
  }

  // Check for multiple starters (high impact players)
  if (highImpactInjuries.length >= 2) {
    contextualNotes.push('missing two starters');
  }

  // Check for blowout risk (3+ high impact players out)
  if (highImpactInjuries.length >= 3) {
    contextualNotes.push('possible blowout risk');
  }

  // Combine injury list with contextual notes
  let result = injuryList.join(', ');
  if (contextualNotes.length > 0) {
    result += `; ${contextualNotes.join(', ')}`;
  }

  return result;
}

/**
 * Calculate standard deviation
 */
function calculateStdDev(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Build prop-specific features for fine-tuned model
 */
function buildPropFeatures(games, playerName, propType, nextGameInfo, injuryData, bettingLine) {
  const chronologicalGames = [...games].reverse();
  const valuesArray = chronologicalGames.map(g => getPropValue(g, propType));

  const avgValue = valuesArray.reduce((a, b) => a + b, 0) / valuesArray.length;
  const stdDev = calculateStdDev(valuesArray);
  const volatility = avgValue > 0 ? (stdDev / avgValue) * 100 : 0;

  const recent3Count = Math.min(3, valuesArray.length);
  const recent5Count = Math.min(5, valuesArray.length);
  const recent3Avg = valuesArray.slice(-recent3Count).reduce((a, b) => a + b, 0) / recent3Count;
  const recent5Avg = valuesArray.slice(-recent5Count).reduce((a, b) => a + b, 0) / recent5Count;

  // Minutes calculations
  const minutesData = chronologicalGames.map(g => parseMinutes(g.minutes)).filter(m => m !== null);
  const avgMinutes = minutesData.length > 0
    ? minutesData.reduce((sum, mins) => sum + mins, 0) / minutesData.length
    : null;
  
  const recent3Minutes = minutesData.slice(-recent3Count).filter(m => m !== null);
  const recent3MinutesAvg = recent3Minutes.length > 0
    ? recent3Minutes.reduce((sum, mins) => sum + mins, 0) / recent3Minutes.length
    : null;

  // Injury status
  const playerInjury = getPlayerInjuryStatus(injuryData, playerName);

  // Format opponent injuries (prop-specific context)
  const oppInjuries = injuryData?.opponentInjuries || [];
  const oppInjuriesFormatted = formatOpponentInjuries(oppInjuries, propType);

  // Usage rate (estimated from points per minute and minutes played)
  const pointsArray = chronologicalGames.map(g => {
    const pts = typeof g.points === 'number' ? g.points : parseFloat(g.points) || 0;
    return Math.max(0, pts);
  });
  const avgPoints = pointsArray.reduce((a, b) => a + b, 0) / pointsArray.length;
  const usageRate = avgMinutes && avgMinutes > 0 && avgPoints > 0 
    ? Math.min(100, Math.max(0, (avgPoints / avgMinutes) * 2.5))
    : null;

  // Prop-specific calculations
  let reboundShare = null;
  let potentialAssists = null;
  let threePointAttempts = null;

  // For rebounds: calculate rebound share
  if (propType === 'rebounds' || propType === 'points_rebounds' || propType === 'rebounds_assists' || propType === 'points_rebounds_assists') {
    // Estimate rebound share (simplified - would need team rebounds)
    const avgRebounds = avgValue;
    reboundShare = avgMinutes && avgMinutes > 0 ? (avgRebounds / avgMinutes) * 0.15 : null; // Rough estimate
  }

  // For assists: estimate potential assists
  if (propType === 'assists' || propType === 'points_assists' || propType === 'rebounds_assists' || propType === 'points_rebounds_assists') {
    // Potential assists estimate (simplified)
    potentialAssists = avgValue * 1.5; // Rough estimate
  }

  // For 3PM: get three point attempts
  if (propType === 'threes' || propType === 'threes_made') {
    const threeAttemptsArray = chronologicalGames.map(g => {
      const tpa = typeof g.three_pointers_attempted === 'number' ? g.three_pointers_attempted :
                  typeof g.tpa === 'number' ? g.tpa :
                  typeof g.three_point_attempts === 'number' ? g.three_point_attempts :
                  parseFloat(g.three_pointers_attempted || g.tpa || g.three_point_attempts) || 0;
      return Math.max(0, tpa);
    });
    threePointAttempts = threeAttemptsArray.reduce((a, b) => a + b, 0) / threeAttemptsArray.length;
  }

  // Pace and defensive stats (would ideally come from team stats APIs)
  // For now, use null if not available (matches training format)
  const pace = null; // Would need team pace data
  const oppDef = null; // Would need opponent defensive rating (prop-specific)
  const oppVsPosition = null; // Would need position-specific defensive stats (prop-specific)

  return {
    playerName,
    propType,
    vegasLine: bettingLine || null,
    recentAvg3: Math.round(recent3Avg * 10) / 10,
    recentAvg5: Math.round(recent5Avg * 10) / 10,
    seasonAvg: Math.round(avgValue * 10) / 10,
    minutes: recent3MinutesAvg || avgMinutes || null,
    usageRate: usageRate ? Math.round(usageRate * 10) / 10 : null,
    pace,
    oppDef,
    oppVsPosition,
    injuryStatus: playerInjury.status,
    oppInjuries: oppInjuriesFormatted,
    // Prop-specific features
    reboundShare: reboundShare ? Math.round(reboundShare * 10) / 10 : null,
    potentialAssists: potentialAssists ? Math.round(potentialAssists * 10) / 10 : null,
    threePointAttempts: threePointAttempts ? Math.round(threePointAttempts * 10) / 10 : null,
    // Keep for backward compatibility
    gamesCount: games.length,
    volatility: Math.round(volatility * 10) / 10,
    stdDev: Math.round(stdDev * 10) / 10,
    nextGameInfo
  };
}

/**
 * Generate numeric prediction using fine-tuned model - EXACT TRAINING FORMAT
 */
async function generateNumericPrediction(features, maxRetries = 3) {
  const {
    playerName, propType, vegasLine, recentAvg3, recentAvg5, seasonAvg,
    minutes, usageRate, pace, oppDef, oppVsPosition, injuryStatus, oppInjuries
  } = features;

  // Map prop type to standardized format
  const propTypeFormatted = PROP_TYPE_MAP[propType] || propType.toUpperCase();

  // Build input in EXACT training format
  const formatValue = (val) => {
    if (val === null || val === undefined) return 'null';
    if (typeof val === 'number') return val.toFixed(1);
    return val.toString();
  };

  // Use season avg as fallback for vegas_line if not available
  const vegasLineValue = vegasLine || seasonAvg;

  const userInput = `player: ${playerName}
prop_type: ${propTypeFormatted}
vegas_line: ${formatValue(vegasLineValue)}
season_avg: ${seasonAvg.toFixed(1)}
recent_avg_5: ${recentAvg5.toFixed(1)}
recent_avg_3: ${recentAvg3.toFixed(1)}
usage: ${formatValue(usageRate)}
minutes: ${formatValue(minutes)}
pace: ${formatValue(pace)}
opp_def: ${formatValue(oppDef)}
opp_vs_position: ${formatValue(oppVsPosition)}
injury: ${injuryStatus || 'active'}
opp_injuries: ${oppInjuries || 'none'}`;

  // LOG EXACT PROMPT FOR VERIFICATION
  console.log(`\n📤 [MODEL INPUT - ${propTypeFormatted}] Exact prompt sent to fine-tuned model:`);
  console.log('='.repeat(80));
  console.log(userInput);
  console.log('='.repeat(80));

  const systemMessage = "Predict NBA stats using structured features. Output only a number.";

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`📤 [PREDICTION-${propTypeFormatted}] Attempt ${attempt}/${maxRetries} - Calling fine-tuned model...`);

    try {
      const completion = await getOpenAIClient().chat.completions.create({
        model: process.env.FINE_TUNED_MODEL_ID || "ft:gpt-3.5-turbo-0125:personal::CdszvDdV",
        messages: [
          {
            role: "system",
            content: systemMessage
          },
          {
            role: "user",
            content: userInput
          }
        ],
        temperature: 0.0,
        top_p: 1.0,
        max_tokens: 10
      });

      const responseText = completion.choices[0].message.content.trim();
      console.log(`📥 [PREDICTION-${propTypeFormatted}] Raw model output (attempt ${attempt}):`, responseText);

      // Extract number from response (model outputs just a number)
      const numberMatch = responseText.match(/(\d+\.?\d*)/);
      if (!numberMatch) {
        throw new Error(`No number found in response: ${responseText}`);
      }

      const predictedValue = parseFloat(numberMatch[1]);

      if (!Number.isFinite(predictedValue) || predictedValue < 0) {
        throw new Error(`Invalid prediction: ${predictedValue}. Must be a finite positive number.`);
      }

      // Special case: if player is OUT, prediction must be 0
      if (injuryStatus === 'out' && predictedValue !== 0) {
        console.log(`🏥 [PREDICTION-${propTypeFormatted}] Player is OUT, setting prediction to 0`);
        return 0;
      }

      console.log(`✅ [PREDICTION-${propTypeFormatted}] Valid prediction extracted: ${predictedValue}`);
      return predictedValue;
    } catch (error) {
      console.error(`❌ [PREDICTION-${propTypeFormatted}] Attempt ${attempt} failed:`, error.message);
      if (attempt < maxRetries) {
        console.log(`🔄 [PREDICTION-${propTypeFormatted}] Retrying...`);
        continue;
      }
      throw new Error(`Failed to generate prediction after ${maxRetries} attempts: ${error.message}`);
    }
  }

  throw new Error('Failed to generate valid prediction after all retries');
}

/**
 * Generate natural language analysis for any prop prediction
 * @param {number} predictedValue - The predicted value
 * @param {number|null} vegasLine - The Vegas betting line
 * @param {object} stats - Stats object with overall_avg, recent_3_avg, recent_5_avg, volatility, std_dev
 * @param {string} propType - The prop type (e.g., 'points', 'rebounds', 'assists')
 * @returns {string} Natural language analysis
 */
function generateAnalysis(predictedValue, vegasLine, stats, propType) {
  const { overall_avg, recent_3_avg, recent_5_avg, volatility, std_dev } = stats;
  
  // Get prop display name for combined stats
  const isCombinedProp = propType === 'points_rebounds' || propType === 'points_assists' || 
                         propType === 'rebounds_assists' || propType === 'points_rebounds_assists';
  
  const combinedPropNames = {
    'points_rebounds': 'points and rebounds',
    'points_assists': 'points and assists',
    'rebounds_assists': 'rebounds and assists',
    'points_rebounds_assists': 'points, rebounds, and assists'
  };
  
  // For combined props, use "combined stat" terminology
  const propNameSingular = isCombinedProp ? 'combined stat' : 
                           propType === 'points' ? 'point' : 
                           propType === 'rebounds' ? 'rebound' :
                           propType === 'assists' ? 'assist' :
                           propType === 'steals' ? 'steal' :
                           propType === 'blocks' ? 'block' :
                           propType === 'threes' || propType === 'threes_made' ? 'three-pointer' :
                           propType === 'turnovers' ? 'turnover' :
                           propType;
  
  const propNamePlural = isCombinedProp ? 'combined stats' :
                         propType === 'points' ? 'points' :
                         propType === 'rebounds' ? 'rebounds' :
                         propType === 'assists' ? 'assists' :
                         propType === 'steals' ? 'steals' :
                         propType === 'blocks' ? 'blocks' :
                         propType === 'threes' || propType === 'threes_made' ? 'three-pointers' :
                         propType === 'turnovers' ? 'turnovers' :
                         propType;
  
  // Build analysis sentences
  const sentences = [];
  
  // Opening sentence with prediction
  if (isCombinedProp) {
    sentences.push(`The model projects ${predictedValue.toFixed(1)} ${combinedPropNames[propType]} for the upcoming game.`);
  } else {
    sentences.push(`The model projects ${predictedValue.toFixed(1)} ${propNamePlural} for the upcoming game.`);
  }
  
  // Analyze trend: recent_3_avg vs season_avg (overall_avg)
  // This is the primary trend analysis based on user requirements
  if (recent_3_avg !== null && recent_3_avg !== undefined && overall_avg !== null && overall_avg !== undefined && overall_avg > 0) {
    const percentDiff = ((recent_3_avg - overall_avg) / overall_avg) * 100;
    
    // Rule 1: recent_3_avg > season_avg by +5% or more
    if (percentDiff >= 5) {
      // Describe as upswing, positive momentum, or above-trend scoring
      const trendPhrases = [
        { phrase: 'upswing', article: 'an' },
        { phrase: 'positive momentum', article: 'a' },
        { phrase: 'above-trend scoring', article: 'an' }
      ];
      const trend = trendPhrases[Math.floor(Math.random() * trendPhrases.length)];
      
      if (isCombinedProp) {
        sentences.push(`Recent performance shows ${trend.article} ${trend.phrase}, with ${recent_3_avg.toFixed(1)} ${combinedPropNames[propType]} in the last 3 games compared to the season average of ${overall_avg.toFixed(1)}.`);
      } else {
        sentences.push(`Recent performance shows ${trend.article} ${trend.phrase}, with ${recent_3_avg.toFixed(1)} ${propNamePlural} in the last 3 games compared to the season average of ${overall_avg.toFixed(1)}.`);
      }
      
      // Only mention regression if explicitly stating it as mild regression toward average
      // Check if prediction is below recent_3_avg, suggesting the model accounts for some regression
      if (predictedValue < recent_3_avg) {
        if (isCombinedProp) {
          sentences.push(`There may be mild regression toward the season average, which is reflected in this projection.`);
        } else {
          sentences.push(`There may be mild regression toward the season average, which is reflected in this projection.`);
        }
      }
    }
    // Rule 2: recent_3_avg is within ±5% of season_avg
    else if (percentDiff > -5 && percentDiff < 5) {
      // Describe as consistent with season norms or in line with typical performance
      const consistencyPhrases = ['consistent with season norms', 'in line with typical performance'];
      const consistencyPhrase = consistencyPhrases[Math.floor(Math.random() * consistencyPhrases.length)];
      
      if (isCombinedProp) {
        sentences.push(`Recent form (${recent_3_avg.toFixed(1)} ${combinedPropNames[propType]} in last 3 games) is ${consistencyPhrase} (season average: ${overall_avg.toFixed(1)}).`);
      } else {
        sentences.push(`Recent form (${recent_3_avg.toFixed(1)} ${propNamePlural} in last 3 games) is ${consistencyPhrase} (season average: ${overall_avg.toFixed(1)}).`);
      }
      // DO NOT mention regression for this case
    }
    // Rule 3: recent_3_avg < season_avg by -5% or more
    else {
      // Describe as slight downturn, below-trend performance, or recent dip
      const downturnPhrases = [
        { phrase: 'slight downturn', article: 'a' },
        { phrase: 'below-trend performance', article: 'a' },
        { phrase: 'recent dip', article: 'a' }
      ];
      const downturn = downturnPhrases[Math.floor(Math.random() * downturnPhrases.length)];
      
      if (isCombinedProp) {
        sentences.push(`Recent performance shows ${downturn.article} ${downturn.phrase}, with ${recent_3_avg.toFixed(1)} ${combinedPropNames[propType]} in the last 3 games compared to the season average of ${overall_avg.toFixed(1)}.`);
      } else {
        sentences.push(`Recent performance shows ${downturn.article} ${downturn.phrase}, with ${recent_3_avg.toFixed(1)} ${propNamePlural} in last 3 games compared to the season average of ${overall_avg.toFixed(1)}.`);
      }
      
      // Only mention regression if clearly stated as positive regression toward average
      // Check if prediction is above recent_3_avg, suggesting the model accounts for positive regression
      if (predictedValue > recent_3_avg) {
        if (isCombinedProp) {
          sentences.push(`The projection accounts for possible positive regression upward toward the season average.`);
        } else {
          sentences.push(`The projection accounts for possible positive regression upward toward the season average.`);
        }
      }
    }
    
    // Add recent 5-game context if available
    if (recent_5_avg !== null && recent_5_avg !== undefined) {
      if (isCombinedProp) {
        sentences.push(`Over the last 5 games, the player has averaged ${recent_5_avg.toFixed(1)} ${combinedPropNames[propType]}.`);
      } else {
        sentences.push(`Over the last 5 games, the player has averaged ${recent_5_avg.toFixed(1)} ${propNamePlural}.`);
      }
    }
  }
  // Fallback: if we don't have recent_3_avg, compare prediction to season average
  else if (overall_avg !== null && overall_avg !== undefined) {
    const avgDiff = predictedValue - overall_avg;
    if (Math.abs(avgDiff) < 0.5) {
      if (isCombinedProp) {
        sentences.push(`This aligns closely with the player's season average of ${overall_avg.toFixed(1)} ${combinedPropNames[propType]}.`);
      } else {
        sentences.push(`This aligns closely with the player's season average of ${overall_avg.toFixed(1)} ${propNamePlural}.`);
      }
    } else if (avgDiff > 0) {
      if (isCombinedProp) {
        sentences.push(`This is above the player's season average of ${overall_avg.toFixed(1)} ${combinedPropNames[propType]}.`);
      } else {
        sentences.push(`This is above the player's season average of ${overall_avg.toFixed(1)} ${propNamePlural}.`);
      }
    } else {
      if (isCombinedProp) {
        sentences.push(`This is below the player's season average of ${overall_avg.toFixed(1)} ${combinedPropNames[propType]}.`);
      } else {
        sentences.push(`This is below the player's season average of ${overall_avg.toFixed(1)} ${propNamePlural}.`);
      }
    }
  }
  
  // Reference to volatility/consistency
  if (volatility !== null && volatility !== undefined) {
    if (volatility < 20) {
      sentences.push(`The player has shown consistent performance with low volatility (${volatility.toFixed(1)}%), increasing confidence in this prediction.`);
    } else if (volatility < 40) {
      sentences.push(`Moderate volatility (${volatility.toFixed(1)}%) indicates some variability, which is considered in the projection.`);
    } else {
      sentences.push(`High volatility (${volatility.toFixed(1)}%) suggests significant game-to-game variation, making this prediction more uncertain.`);
    }
  }
  
  // Reference to Vegas line if available
  if (vegasLine !== null && vegasLine !== undefined) {
    const lineDiff = predictedValue - vegasLine;
    if (Math.abs(lineDiff) < 0.5) {
      sentences.push(`This projection closely matches the Vegas line of ${vegasLine.toFixed(1)}.`);
    } else if (lineDiff > 0) {
      sentences.push(`The model projects above the Vegas line of ${vegasLine.toFixed(1)}, suggesting potential value on the over.`);
    } else {
      sentences.push(`The model projects below the Vegas line of ${vegasLine.toFixed(1)}, suggesting potential value on the under.`);
    }
  }
  
  // Join sentences with proper spacing
  return sentences.join(' ');
}

/**
 * Calculate confidence level from prediction vs vegas line
 */
function calculateConfidenceLevel(predictedValue, vegasLine) {
  if (!vegasLine) return 'Medium';
  
  const diff = Math.abs(predictedValue - vegasLine);
  const diffPercent = (diff / vegasLine) * 100;
  
  // Small difference = high confidence
  if (diffPercent <= 5) return 'High';
  // Moderate difference = medium confidence
  if (diffPercent <= 15) return 'Medium';
  // Large difference = low confidence
  return 'Low';
}

/**
 * Calculate error margin from volatility (2.0 to 6.0)
 */
function calculateErrorMargin(volatility) {
  if (volatility < 20) {
    return 2.0 + (volatility / 20) * 1.0; // 2.0 to 3.0
  } else if (volatility < 50) {
    return 3.0 + ((volatility - 20) / 30) * 1.5; // 3.0 to 4.5
  } else {
    return 4.5 + Math.min((volatility - 50) / 50, 1.0) * 1.5; // 4.5 to 6.0
  }
}

/**
 * Calculate recommendation based on model output vs vegas line
 */
function calculateRecommendation(predictedValue, vegasLine) {
  if (!vegasLine) return null;
  
  const diff = predictedValue - vegasLine;
  
  if (diff > 0.5) return 'OVER';
  if (diff < -0.5) return 'UNDER';
  return null;
}

/**
 * Predict any prop type from games array using fine-tuned model
 * This is the UNIFIED prediction function for ALL props
 */
export async function predictPropFromGames(games, playerName, propType = 'points', nextGameInfo = null, injuryData = null, bettingLine = null) {
  if (!games || games.length < 3) {
    throw new Error(`Insufficient game data for prediction. Need at least 3 games, got ${games?.length || 0}.`);
  }

  const propTypeFormatted = PROP_TYPE_MAP[propType] || propType.toUpperCase();
  console.log(`\n🤖 [PIPELINE-${propTypeFormatted}] Starting prediction for ${playerName} (${games.length} games)`);

  try {
    // Step 1: Build prop-specific features
    console.log(`📊 [PIPELINE-${propTypeFormatted}] Step 1: Building prop-specific features...`);
    const features = buildPropFeatures(games, playerName, propType, nextGameInfo, injuryData, bettingLine);
    console.log(`✅ [PIPELINE-${propTypeFormatted}] Features built:`, {
      seasonAvg: features.seasonAvg,
      recent3Avg: features.recentAvg3,
      recent5Avg: features.recentAvg5,
      vegasLine: features.vegasLine,
      injuryStatus: features.injuryStatus,
      oppInjuries: features.oppInjuries.substring(0, 50) + '...'
    });

    // Step 2: Handle OUT players immediately
    if (features.injuryStatus === 'out') {
      console.log(`🏥 [PIPELINE-${propTypeFormatted}] Player is OUT - returning 0`);
      
      // Build stats object for analysis
      const statsForAnalysis = {
        overall_avg: features.seasonAvg,
        recent_3_avg: features.recentAvg3,
        recent_5_avg: features.recentAvg5,
        volatility: features.volatility,
        std_dev: features.stdDev
      };
      
      // Generate analysis even for OUT players (explains why prediction is 0)
      const analysis = `The player is currently listed as out and will not play in the upcoming game. This prediction reflects that status.`;
      
      return {
        player: playerName,
        [`predicted_${propType}`]: 0,
        predicted_points: propType === 'points' ? 0 : null,
        analysis: analysis,
        confidence: 'High',
        error_margin: 0,
        recommendation: null,
        games_used: games.length,
        method: 'fine_tuned_model',
        prop_type: propType,
        stats: statsForAnalysis
      };
    }

    // Step 3: Generate numeric prediction using fine-tuned model ONLY
    console.log(`🔮 [PIPELINE-${propTypeFormatted}] Step 3: Calling fine-tuned model...`);
    const predictedValue = await generateNumericPrediction(features);

    // Step 4: Use model output directly (NO adjustments)
    const finalPredictedValue = predictedValue;
    console.log(`✅ [PIPELINE-${propTypeFormatted}] Model prediction: ${finalPredictedValue.toFixed(1)}`);

    // Step 5: Calculate confidence from |prediction - vegas_line|
    const confidenceLevel = calculateConfidenceLevel(finalPredictedValue, features.vegasLine);

    // Step 6: Calculate error margin from volatility (2.0 to 6.0)
    const errorMargin = calculateErrorMargin(features.volatility);

    // Step 7: Calculate recommendation from model_output vs vegas_line
    const recommendation = calculateRecommendation(finalPredictedValue, features.vegasLine);

    // Step 8: Build result object
    // Ensure we always have the correct field name for the prop type
    const predictedFieldName = `predicted_${propType}`;
    const predictedValueRounded = Math.max(0, Math.round(finalPredictedValue * 10) / 10);
    
    // Build stats object for analysis
    const statsForAnalysis = {
      overall_avg: features.seasonAvg,
      recent_3_avg: features.recentAvg3,
      recent_5_avg: features.recentAvg5,
      volatility: features.volatility,
      std_dev: features.stdDev
    };
    
    // Generate natural language analysis using shared function
    const analysis = generateAnalysis(finalPredictedValue, features.vegasLine, statsForAnalysis, propType);
    
    const predictionResult = {
      player: playerName,
      [predictedFieldName]: predictedValueRounded,
      // For backward compatibility, also include predicted_points if it's points
      predicted_points: propType === 'points' ? predictedValueRounded : null,
      analysis: analysis,
      confidence: confidenceLevel,
      error_margin: Math.round(errorMargin * 10) / 10,
      recommendation: recommendation,
      games_used: games.length,
      method: 'fine_tuned_model',
      prop_type: propType,
      stats: statsForAnalysis
    };
    
    // Log the response structure for debugging
    console.log(`📋 [PIPELINE-${propTypeFormatted}] Response structure:`, {
      [predictedFieldName]: predictionResult[predictedFieldName],
      confidence: predictionResult.confidence,
      recommendation: predictionResult.recommendation
    });

    console.log(`✅ [PIPELINE-${propTypeFormatted}] Prediction complete:`, {
      [`predicted_${propType}`]: predictionResult[`predicted_${propType}`],
      confidence: predictionResult.confidence,
      recommendation: predictionResult.recommendation
    });

    // Store prediction for tracking (if next game info is available)
    if (nextGameInfo && nextGameInfo.date && propType === 'points') {
      try {
        storePrediction(playerName, predictionResult, games, nextGameInfo);
      } catch (trackError) {
        console.warn('⚠️ Failed to store prediction for tracking:', trackError.message);
      }
    }

    return predictionResult;
  } catch (error) {
    console.error(`❌ [PIPELINE-${propTypeFormatted}] Prediction failed:`, error);
    throw new Error(`Prediction failed for ${propType}: ${error.message}`);
  }
}

