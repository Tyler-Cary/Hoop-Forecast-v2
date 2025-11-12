import { getPlayerStats } from './balldontlieService.js';
import pkg from 'ml-regression';

// ml-regression uses SimpleLinearRegression, not LinearRegression
const { SimpleLinearRegression } = pkg;

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
 * Calculate standard deviation
 */
function calculateStdDev(values) {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

