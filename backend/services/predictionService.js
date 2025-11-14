import pkg from 'ml-regression';
import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// ml-regression uses SimpleLinearRegression, not LinearRegression
const { SimpleLinearRegression } = pkg;

// Initialize OpenAI client
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY
});

/**
 * Predict next game points using linear regression
 * Uses the player's last 10 games to build a regression model
 */
export async function predictPoints(playerId) {
  try {
    console.log(`🔮 Generating prediction for player ID: ${playerId}`);
    
    // Fetch player stats
    const statsData = await getPlayerStats(playerId);
    console.log('📊 Stats data received:', {
      hasGames: !!statsData.games,
      gamesCount: statsData.games?.length || 0,
      player: statsData.player
    });
    
    const games = statsData.games;
    const player = statsData.player;

    if (!games || games.length < 3) {
      console.error(`❌ Insufficient games: ${games?.length || 0} games found`);
      throw new Error(`Insufficient game data for prediction. Need at least 3 games, got ${games?.length || 0}.`);
    }
    
    console.log(`✅ Using ${games.length} games for prediction`);

    // Prepare data for regression
    // Games come in most recent first, so we reverse for regression (oldest to newest)
    // X: game number (1, 2, 3, ...) where 1 = oldest game, 10 = most recent
    // Y: points scored in that game
    const reversedGames = [...games].reverse(); // Reverse to get chronological order for regression
    const gameNumbers = reversedGames.map((game, index) => index + 1);
    const playerPoints = reversedGames.map(game => {
      const pts = typeof game.points === 'number' ? game.points : parseFloat(game.points) || 0;
      return Math.max(0, pts); // Ensure non-negative
    });
    
    console.log('📊 Games for regression (oldest to newest):');
    reversedGames.forEach((game, idx) => {
      console.log(`  Game ${idx + 1}: ${game.points} pts vs ${game.opponent}`);
    });
    
    // Validate we have valid data
    if (playerPoints.every(p => p === 0)) {
      throw new Error('All game points are zero or invalid');
    }

    // Calculate mean for confidence calculation
    const meanPoints = playerPoints.reduce((a, b) => a + b, 0) / playerPoints.length;
    const variance = playerPoints.reduce((sum, pts) => sum + Math.pow(pts - meanPoints, 2), 0) / playerPoints.length;
    const stdDev = Math.sqrt(variance);

    // Use weighted average approach - more recent games weighted higher
    // This is more reliable than linear regression for short-term predictions
    console.log('📈 Calculating weighted average prediction...');
    
    // Calculate weights: most recent game gets highest weight
    // Use exponential decay: weight = e^(-decay * age)
    const decay = 0.1; // Lower = more weight to recent games
    const weights = reversedGames.map((game, index) => {
      const age = reversedGames.length - index - 1; // 0 = most recent, 9 = oldest
      return Math.exp(-decay * age);
    });
    
    // Normalize weights
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    const normalizedWeights = weights.map(w => w / totalWeight);
    
    // Calculate weighted average
    let weightedSum = 0;
    for (let i = 0; i < playerPoints.length; i++) {
      weightedSum += playerPoints[i] * normalizedWeights[i];
    }
    
    // Also calculate simple average and recent form (last 3 games)
    const simpleAvg = playerPoints.reduce((a, b) => a + b, 0) / playerPoints.length;
    const recentGames = playerPoints.slice(-3); // Last 3 games
    const recentAvg = recentGames.reduce((a, b) => a + b, 0) / recentGames.length;
    
    // Combine: 50% weighted average, 30% recent form, 20% overall average
    const predictedPoints = (weightedSum * 0.5) + (recentAvg * 0.3) + (simpleAvg * 0.2);
    
    console.log(`🎯 Predicted points: ${predictedPoints.toFixed(1)}`);
    console.log(`   - Weighted avg: ${weightedSum.toFixed(1)}`);
    console.log(`   - Recent 3 avg: ${recentAvg.toFixed(1)}`);
    console.log(`   - Overall avg: ${simpleAvg.toFixed(1)}`);
    
    // Also try linear regression as a secondary check
    let regressionPrediction = null;
    try {
      const regression = new SimpleLinearRegression(gameNumbers, playerPoints);
      const nextGameNumber = games.length + 1;
      regressionPrediction = regression.compute(nextGameNumber);
      console.log(`   - Regression: ${regressionPrediction.toFixed(1)}`);
      
      // If regression is very different, use it as a sanity check
      // But don't let it dominate if it seems off
      if (Math.abs(regressionPrediction - predictedPoints) > 10) {
        console.log('⚠️ Regression differs significantly, using weighted average');
      }
    } catch (regError) {
      console.log('⚠️ Regression failed, using weighted average only');
    }

    // Calculate confidence based on:
    // 1. Number of data points (more = better)
    // 2. Standard deviation (lower = better)
    // 3. Consistency of recent games
    const recentStdDev = calculateStdDev(recentGames);
    const consistencyScore = 1 - Math.min(recentStdDev / (recentAvg || 1), 1);
    
    const confidence = Math.min(100, Math.max(0, 
      (games.length / 10) * 40 + // Up to 40% for data points
      consistencyScore * 40 + // Up to 40% for consistency
      (1 - Math.min(stdDev / meanPoints, 1)) * 20 // Up to 20% for overall consistency
    ));

    // Error margin: 1 standard deviation
    const errorMargin = stdDev;

    const result = {
      player: `${player.first_name} ${player.last_name}`,
      predicted_points: Math.max(0, Math.round(predictedPoints * 10) / 10), // Round to 1 decimal, ensure non-negative
      confidence: Math.round(confidence * 10) / 10,
      error_margin: Math.round(errorMargin * 10) / 10,
      games_used: games.length,
      method: 'weighted_average',
      stats: {
        weighted_avg: Math.round(weightedSum * 10) / 10,
        recent_avg: Math.round(recentAvg * 10) / 10,
        overall_avg: Math.round(simpleAvg * 10) / 10
      }
    };
    
    console.log('✅ Prediction result:', result);
    return result;
  } catch (error) {
    console.error('Error in prediction service:', error);
    console.error('Error details:', error.stack);
    
    // If we have stats but prediction failed, try a simple average as fallback
    if (games && games.length >= 3) {
      console.warn('Using average as fallback prediction');
      const avgPoints = games.reduce((sum, game) => {
        const pts = typeof game.points === 'number' ? game.points : parseFloat(game.points) || 0;
        return sum + pts;
      }, 0) / games.length;
      
      return {
        player: `${player?.first_name || 'Player'} ${player?.last_name || ''}`,
        predicted_points: Math.round(avgPoints * 10) / 10,
        confidence: 50, // Lower confidence for fallback
        error_margin: 5,
        games_used: games.length,
        note: 'Using average as fallback - regression failed'
      };
    }
    
    throw new Error(`Failed to generate prediction: ${error.message}`);
  }
}

/**
 * Predict points from games array using ChatGPT
 */
export async function predictPointsFromGames(games, playerName) {
  if (!games || games.length < 3) {
    throw new Error(`Insufficient game data for prediction. Need at least 3 games, got ${games?.length || 0}.`);
  }

  console.log(`🤖 Using ChatGPT to predict points for ${playerName} based on ${games.length} games`);

  try {
    // Prepare full game data for ChatGPT (oldest to newest)
    const chronologicalGames = [...games].reverse();
    const gameData = chronologicalGames.map((game, index) => {
      const points = typeof game.points === 'number' ? game.points : parseFloat(game.points) || 0;
      const opponent = game.opponent || 'Unknown';
      const date = game.date || 'Unknown';
      const season = game.season || 'Unknown';
      const minutes = game.minutes ?? null;
      const isHomeRaw = typeof game.isHome === 'boolean'
        ? game.isHome
        : typeof game.home === 'boolean'
          ? game.home
          : typeof game.location === 'string'
            ? game.location.toLowerCase().includes('home')
            : null;
      const isHome = isHomeRaw === null ? null : Boolean(isHomeRaw);
      const location = isHome === null ? 'Unknown' : (isHome ? 'Home' : 'Away');

      return {
        sequence: index + 1,
        date,
        opponent,
        points,
        minutes,
        season,
        isHome,
        location
      };
    });

    const pointsArray = gameData.map(g => g.points);
    const avgPoints = pointsArray.reduce((a, b) => a + b, 0) / pointsArray.length;

    const recent3Count = Math.min(3, pointsArray.length);
    const recent5Count = Math.min(5, pointsArray.length);
    const recent3Avg = pointsArray.slice(-recent3Count).reduce((a, b) => a + b, 0) / recent3Count;
    const recent5Avg = pointsArray.slice(-recent5Count).reduce((a, b) => a + b, 0) / recent5Count;
    const momentum = recent3Avg - recent5Avg;

    const seasonGroups = gameData.reduce((acc, game) => {
      const season = game.season || 'Unknown';
      acc[season] = acc[season] || {
        games: 0,
        totalPoints: 0,
        max: Number.NEGATIVE_INFINITY,
        min: Number.POSITIVE_INFINITY,
        homeGames: 0,
        homePoints: 0,
        awayGames: 0,
        awayPoints: 0
      };
      const group = acc[season];
      group.games += 1;
      group.totalPoints += game.points;
      group.max = Math.max(group.max, game.points);
      group.min = Math.min(group.min, game.points);
      if (game.isHome === true) {
        group.homeGames += 1;
        group.homePoints += game.points;
      } else if (game.isHome === false) {
        group.awayGames += 1;
        group.awayPoints += game.points;
      }
      return acc;
    }, {});

    const seasonSummariesText = Object.entries(seasonGroups)
      .map(([season, data]) => {
        const avg = data.totalPoints / data.games;
        const homeAvg = data.homeGames > 0 ? data.homePoints / data.homeGames : null;
        const awayAvg = data.awayGames > 0 ? data.awayPoints / data.awayGames : null;
        const homeAwayText = [
          homeAvg !== null ? `home avg ${homeAvg.toFixed(1)} (${data.homeGames} games)` : null,
          awayAvg !== null ? `away avg ${awayAvg.toFixed(1)} (${data.awayGames} games)` : null
        ].filter(Boolean).join(', ');
        const extras = homeAwayText ? `; ${homeAwayText}` : '';
        return `- Season ${season}: ${data.games} games, avg ${avg.toFixed(1)}, high ${data.max}, low ${data.min}${extras}`;
      })
      .join('\n');

    const maxPoints = Math.max(...pointsArray);
    const minPoints = Math.min(...pointsArray);
    const stdDev = calculateStdDev(pointsArray);
    const recentStdDev = calculateStdDev(pointsArray.slice(-recent3Count));

    const midpoint = Math.max(1, Math.floor(pointsArray.length / 2));
    const firstHalf = pointsArray.slice(0, midpoint);
    const secondHalfRaw = pointsArray.slice(midpoint);
    const secondHalf = secondHalfRaw.length > 0 ? secondHalfRaw : firstHalf;
    const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    const trendDelta = secondHalfAvg - firstHalfAvg;
    const trend = trendDelta > 1 ? 'increasing' : trendDelta < -1 ? 'decreasing' : 'stable';

    const homeGames = gameData.filter(g => g.isHome === true);
    const awayGames = gameData.filter(g => g.isHome === false);
    const homeAvg = homeGames.length > 0
      ? homeGames.reduce((sum, g) => sum + g.points, 0) / homeGames.length
      : avgPoints;
    const awayAvg = awayGames.length > 0
      ? awayGames.reduce((sum, g) => sum + g.points, 0) / awayGames.length
      : avgPoints;
    const homeAwayDiff = homeAvg - awayAvg;

    const consistencyBase = Math.max(Math.abs(recent3Avg), 1);
    const consistencyScore = 1 - Math.min(recentStdDev / consistencyBase, 1);
    const normalizedStd = avgPoints > 0 ? Math.min(stdDev / avgPoints, 1) : 1;
    const autoConfidence = Math.min(100, Math.max(0,
      (games.length / 10) * 40 +
      consistencyScore * 40 +
      (1 - normalizedStd) * 20
    ));

    const gameLogText = gameData.map(g => {
      const minutesText = g.minutes ? `, ${g.minutes} min` : '';
      return `Game ${g.sequence}: ${g.points} pts vs ${g.opponent} on ${g.date} (${g.location}${minutesText})`;
    }).join('\n');

    const prompt = `You are an expert NBA data scientist tasked with projecting the next game points for ${playerName}.

Complete game log (oldest to newest):
${gameLogText}

Aggregated indicators derived from the log:
- Overall average: ${avgPoints.toFixed(2)}
- Recent 5-game average: ${recent5Avg.toFixed(2)}
- Recent 3-game average: ${recent3Avg.toFixed(2)}
- Momentum (recent3 - recent5): ${momentum.toFixed(2)}
- Standard deviation: ${stdDev.toFixed(2)}
- Consistency factor (1 = very consistent): ${(1 - normalizedStd).toFixed(2)}
- Trend delta (second half avg minus first half avg): ${trendDelta.toFixed(2)} (${trend})
- Home average (${homeGames.length} games): ${homeAvg.toFixed(2)}
- Away average (${awayGames.length} games): ${awayAvg.toFixed(2)}
- Home vs away difference: ${homeAwayDiff.toFixed(2)}
- Highest points: ${maxPoints}
- Lowest points: ${minPoints}

Season summaries:
${seasonSummariesText || '- No season breakdown available'}

Fit a weighted projection model that leverages the complete data set, including recent form, overall production, trend, consistency, and home/away splits.

Return ONLY valid JSON with this exact structure (numbers must be numeric values, not strings):
{
  "prediction": {
    "predicted_points": number,
    "confidence": number, // 0-100
    "error_margin": number, // expected +/- range (one standard deviation)
    "justification": string
  },
  "model": {
    "weights": {
      "recent_form": number,
      "overall": number,
      "trend": number,
      "consistency": number,
      "home_away": number,
      "bias": number
    },
    "notes": string
  }
}

Ensure the predicted_points reflects the weighted combination you derive from the factors plus the bias.`;

    console.log('📤 Sending full game history to ChatGPT...');

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert NBA data scientist. Always respond with valid JSON following the specified schema."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 350
    });

    const responseText = completion.choices[0].message.content.trim();
    console.log(`📥 ChatGPT model response: "${responseText}"`);

    let modelResult;
    try {
      modelResult = JSON.parse(responseText);
    } catch (parseError) {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        modelResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error(`Failed to parse ChatGPT response as JSON: ${responseText}`);
      }
    }

    const predictedPointsRaw =
      modelResult?.prediction?.predicted_points ??
      modelResult?.prediction?.points ??
      modelResult?.predicted_points;
    const predictedPoints = parseFloat(predictedPointsRaw);

    if (!Number.isFinite(predictedPoints) || predictedPoints < 0) {
      throw new Error(`Invalid prediction from ChatGPT: ${predictedPointsRaw}`);
    }

    const modelConfidenceRaw = modelResult?.prediction?.confidence;
    const confidenceFromModel = parseFloat(modelConfidenceRaw);
    const modelErrorMarginRaw = modelResult?.prediction?.error_margin;
    const errorMarginFromModel = parseFloat(modelErrorMarginRaw);

    const errorMargin = Number.isFinite(errorMarginFromModel) && errorMarginFromModel >= 0
      ? errorMarginFromModel
      : stdDev;
    const confidence = Number.isFinite(confidenceFromModel)
      ? Math.max(0, Math.min(100, confidenceFromModel))
      : autoConfidence;

    console.log(`✅ ChatGPT model prediction: ${predictedPoints.toFixed(1)} pts (confidence: ${confidence.toFixed(1)}%)`);

    const stats = {
      overall_avg: Math.round(avgPoints * 10) / 10,
      recent_5_avg: Math.round(recent5Avg * 10) / 10,
      recent_3_avg: Math.round(recent3Avg * 10) / 10,
      momentum: Math.round(momentum * 10) / 10,
      std_dev: Math.round(stdDev * 10) / 10,
      consistency_factor: Math.round((1 - normalizedStd) * 100) / 100,
      trend: trend,
      trend_delta: Math.round(trendDelta * 10) / 10,
      home_avg: Math.round(homeAvg * 10) / 10,
      away_avg: Math.round(awayAvg * 10) / 10,
      home_games: homeGames.length,
      away_games: awayGames.length,
      home_away_diff: Math.round(homeAwayDiff * 10) / 10,
      max: maxPoints,
      min: minPoints,
      season_summaries: Object.fromEntries(Object.entries(seasonGroups).map(([season, data]) => {
        const avg = data.totalPoints / data.games;
        const homeAvg = data.homeGames > 0 ? data.homePoints / data.homeGames : null;
        const awayAvg = data.awayGames > 0 ? data.awayPoints / data.awayGames : null;
        return [season, {
          games: data.games,
          average: Math.round(avg * 10) / 10,
          high: data.max,
          low: data.min,
          home_avg: homeAvg !== null ? Math.round(homeAvg * 10) / 10 : null,
          away_avg: awayAvg !== null ? Math.round(awayAvg * 10) / 10 : null
        }];
      }))
    };

    if (Number.isFinite(confidenceFromModel)) {
      stats.chatgpt_confidence = Math.round(confidenceFromModel * 10) / 10;
    }

    if (Number.isFinite(errorMarginFromModel)) {
      stats.chatgpt_error_margin = Math.round(errorMarginFromModel * 10) / 10;
    }

    if (modelResult?.prediction?.justification) {
      stats.justification = modelResult.prediction.justification;
    }

    if (modelResult?.model?.notes) {
      stats.model_notes = modelResult.model.notes;
    }

    if (modelResult?.model?.weights) {
      stats.weights = modelResult.model.weights;
    }

    return {
      player: playerName || 'Player',
      predicted_points: Math.max(0, Math.round(predictedPoints * 10) / 10),
      confidence: Math.round(confidence * 10) / 10,
      error_margin: Math.round(Math.abs(errorMargin) * 10) / 10,
      games_used: games.length,
      method: 'chatgpt_model',
      stats
    };
  } catch (error) {
    console.error('❌ ChatGPT prediction failed:', error);
    throw new Error(`ChatGPT prediction failed: ${error.message}`);
  }
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

