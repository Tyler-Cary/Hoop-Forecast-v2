import { getPendingEvaluations, updatePredictionOutcome, findPredictionByGame } from './predictionTrackingService.js';
import { getPlayerStatsFromNBA, searchPlayer } from './nbaApiService.js';

/**
 * Automatically evaluate pending predictions by fetching actual game results
 * This matches predictions with their actual outcomes from NBA.com
 */
export async function evaluatePendingPredictions() {
  console.log('🔄 Starting automatic prediction evaluation...');
  
  const pending = getPendingEvaluations();
  
  if (pending.length === 0) {
    console.log('✅ No pending predictions to evaluate');
    return {
      evaluated: 0,
      failed: 0,
      skipped: 0,
      results: []
    };
  }
  
  console.log(`📊 Found ${pending.length} pending predictions to evaluate`);
  
  const results = {
    evaluated: 0,
    failed: 0,
    skipped: 0,
    results: []
  };
  
  // Process predictions with rate limiting (avoid API overload)
  for (let i = 0; i < pending.length; i++) {
    const prediction = pending[i];
    
    // Add delay between requests to avoid rate limiting (except for first request)
    if (i > 0) {
      const delay = 2000; // 2 seconds between requests
      console.log(`   ⏳ Waiting ${delay}ms before next request...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    try {
      console.log(`\n🔍 Evaluating prediction ${i + 1}/${pending.length}: ${prediction.player_name} (${prediction.id})`);
      console.log(`   Game date: ${prediction.next_game.date}`);
      console.log(`   Predicted: ${prediction.predicted_points} pts`);
      
      // Fetch player's recent games to find the actual result
      // Retry logic with exponential backoff for timeout errors
      let stats = null;
      let retries = 0;
      const maxRetries = 2;
      
      while (retries <= maxRetries && !stats) {
        try {
          stats = await getPlayerStatsFromNBA(prediction.player_name);
        } catch (error) {
          if (error.message.includes('timeout') && retries < maxRetries) {
            retries++;
            const backoffDelay = 3000 * retries; // 3s, 6s
            console.log(`   ⚠️  Timeout error (attempt ${retries}/${maxRetries + 1}), retrying in ${backoffDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, backoffDelay));
            continue;
          }
          throw error; // Re-throw if not a timeout or max retries reached
        }
      }
      
      if (!stats || !stats.games || stats.games.length === 0) {
        console.log(`   ⚠️ No game data found, skipping...`);
        results.skipped++;
        results.results.push({
          predictionId: prediction.id,
          player: prediction.player_name,
          status: 'skipped',
          reason: 'No game data available'
        });
        continue;
      }
      
      // Find the game that matches the prediction date
      // Games are returned most recent first
      const targetDate = prediction.next_game.date;
      const matchingGame = stats.games.find(game => {
        // Compare dates (handle different formats)
        const gameDate = new Date(game.date);
        const targetDateObj = new Date(targetDate);
        
        // Compare year, month, day (ignore time)
        return gameDate.getFullYear() === targetDateObj.getFullYear() &&
               gameDate.getMonth() === targetDateObj.getMonth() &&
               gameDate.getDate() === targetDateObj.getDate();
      });
      
      if (!matchingGame) {
        console.log(`   ⚠️ Game not found for date ${targetDate}, skipping...`);
        console.log(`   Available game dates: ${stats.games.slice(0, 5).map(g => g.date).join(', ')}`);
        results.skipped++;
        results.results.push({
          predictionId: prediction.id,
          player: prediction.player_name,
          status: 'skipped',
          reason: `Game not found for date ${targetDate}`
        });
        continue;
      }
      
      const actualPoints = typeof matchingGame.points === 'number' 
        ? matchingGame.points 
        : parseFloat(matchingGame.points) || 0;
      
      console.log(`   ✅ Found game result: ${actualPoints} pts vs ${matchingGame.opponent}`);
      
      // Update the prediction with actual outcome
      const updated = updatePredictionOutcome(prediction.id, actualPoints);
      
      if (updated) {
        const error = Math.abs(prediction.predicted_points - actualPoints);
        console.log(`   📊 Error: ${error.toFixed(1)} pts, Accuracy: ${updated.accuracy}%`);
        
        results.evaluated++;
        results.results.push({
          predictionId: prediction.id,
          player: prediction.player_name,
          status: 'evaluated',
          predicted: prediction.predicted_points,
          actual: actualPoints,
          error: error,
          accuracy: updated.accuracy,
          withinMargin: updated.within_margin
        });
      } else {
        throw new Error('Failed to update prediction');
      }
      
      // Rate limiting: wait 1 second between API calls to avoid overwhelming NBA.com
      if (i < pending.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
    } catch (error) {
      console.error(`   ❌ Error evaluating prediction ${prediction.id}:`, error.message);
      results.failed++;
      results.results.push({
        predictionId: prediction.id,
        player: prediction.player_name,
        status: 'failed',
        error: error.message
      });
    }
  }
  
  console.log(`\n✅ Evaluation complete:`);
  console.log(`   - Evaluated: ${results.evaluated}`);
  console.log(`   - Failed: ${results.failed}`);
  console.log(`   - Skipped: ${results.skipped}`);
  
  return results;
}

/**
 * Evaluate a specific prediction by ID
 */
export async function evaluatePredictionById(predictionId, actualPoints) {
  try {
    const updated = updatePredictionOutcome(predictionId, actualPoints);
    
    if (!updated) {
      return {
        success: false,
        error: 'Prediction not found'
      };
    }
    
    return {
      success: true,
      prediction: updated
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Find and evaluate a specific prediction by player name and game date
 */
export async function evaluatePredictionByGame(playerName, gameDate, actualPoints) {
  try {
    const prediction = findPredictionByGame(playerName, gameDate);
    
    if (!prediction) {
      return {
        success: false,
        error: 'No matching prediction found'
      };
    }
    
    const updated = updatePredictionOutcome(prediction.id, actualPoints);
    
    return {
      success: true,
      prediction: updated
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

console.log('✅ Prediction evaluation service initialized');

