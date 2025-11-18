import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Persistent storage for predictions and outcomes
const PREDICTIONS_FILE = join(__dirname, '../data/predictions.json');
const PREDICTIONS_DIR = join(__dirname, '../data');

// Ensure data directory exists
if (!fs.existsSync(PREDICTIONS_DIR)) {
  fs.mkdirSync(PREDICTIONS_DIR, { recursive: true });
}

/**
 * Load predictions from file
 */
function loadPredictions() {
  try {
    if (fs.existsSync(PREDICTIONS_FILE)) {
      const data = fs.readFileSync(PREDICTIONS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    console.error('Error loading predictions:', error);
  }
  return { predictions: [] };
}

/**
 * Save predictions to file
 */
function savePredictions(data) {
  try {
    fs.writeFileSync(PREDICTIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving predictions:', error);
  }
}

/**
 * Store a prediction for future evaluation
 * @param {string} playerName - Player name
 * @param {object} prediction - Prediction data
 * @param {array} gameHistory - Games used for prediction
 * @param {object} nextGameInfo - Info about the next game being predicted
 */
export function storePrediction(playerName, prediction, gameHistory, nextGameInfo = {}) {
  const data = loadPredictions();
  
  const predictionRecord = {
    id: `pred_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    player_name: playerName,
    predicted_points: prediction.predicted_points,
    confidence: prediction.confidence,
    error_margin: prediction.error_margin,
    method: prediction.method || 'chatgpt_model',
    stats: prediction.stats || {},
    game_history_hash: gameHistory.map(g => `${g.date}-${g.points}`).join('|'),
    next_game: {
      date: nextGameInfo.date || null,
      opponent: nextGameInfo.opponent || null,
      is_home: nextGameInfo.isHome || null,
      team: nextGameInfo.team || null
    },
    created_at: new Date().toISOString(),
    actual_points: null, // Will be filled when outcome is known
    accuracy: null, // Will be calculated when outcome is known
    evaluated: false
  };
  
  data.predictions.push(predictionRecord);
  savePredictions(data);
  
  console.log(`📝 Stored prediction for ${playerName}: ${prediction.predicted_points} pts`);
  return predictionRecord.id;
}

/**
 * Update prediction with actual outcome
 * @param {string} predictionId - Prediction ID
 * @param {number} actualPoints - Actual points scored
 */
export function updatePredictionOutcome(predictionId, actualPoints) {
  const data = loadPredictions();
  const prediction = data.predictions.find(p => p.id === predictionId);
  
  if (!prediction) {
    console.warn(`⚠️ Prediction ${predictionId} not found`);
    return null;
  }
  
  prediction.actual_points = actualPoints;
  prediction.evaluated = true;
  prediction.evaluated_at = new Date().toISOString();
  
  // Calculate accuracy metrics
  const error = Math.abs(prediction.predicted_points - actualPoints);
  prediction.absolute_error = error;
  prediction.percentage_error = prediction.predicted_points > 0 
    ? (error / prediction.predicted_points) * 100 
    : null;
  prediction.within_margin = error <= prediction.error_margin;
  prediction.within_2x_margin = error <= (prediction.error_margin * 2);
  
  // Calculate accuracy score (0-100)
  if (prediction.error_margin > 0) {
    // Accuracy based on how close to error margin (100% if exact, 0% if >2x margin)
    const normalizedError = Math.min(error / (prediction.error_margin * 2), 1);
    prediction.accuracy = Math.round((1 - normalizedError) * 100);
  } else {
    // Fallback: accuracy based on percentage error
    const pctError = prediction.percentage_error || 0;
    prediction.accuracy = Math.max(0, Math.round(100 - Math.min(pctError, 100)));
  }
  
  savePredictions(data);
  console.log(`✅ Updated prediction ${predictionId}: actual ${actualPoints} pts, error: ${error.toFixed(1)}`);
  
  return prediction;
}

/**
 * Get prediction accuracy statistics
 */
export function getAccuracyStats() {
  const data = loadPredictions();
  const evaluated = data.predictions.filter(p => p.evaluated);
  
  if (evaluated.length === 0) {
    return {
      total_predictions: 0,
      evaluated: 0,
      message: 'No evaluated predictions yet'
    };
  }
  
  const avgError = evaluated.reduce((sum, p) => sum + (p.absolute_error || 0), 0) / evaluated.length;
  const avgAccuracy = evaluated.reduce((sum, p) => sum + (p.accuracy || 0), 0) / evaluated.length;
  const withinMargin = evaluated.filter(p => p.within_margin).length;
  const within2xMargin = evaluated.filter(p => p.within_2x_margin).length;
  
  return {
    total_predictions: data.predictions.length,
    evaluated: evaluated.length,
    pending: data.predictions.length - evaluated.length,
    average_error: Math.round(avgError * 10) / 10,
    average_accuracy: Math.round(avgAccuracy * 10) / 10,
    within_margin_rate: Math.round((withinMargin / evaluated.length) * 100),
    within_2x_margin_rate: Math.round((within2xMargin / evaluated.length) * 100),
    predictions: evaluated.slice(-50) // Last 50 for analysis
  };
}

/**
 * Get predictions that need evaluation (games that have likely been played)
 */
export function getPendingEvaluations() {
  const data = loadPredictions();
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  
  return data.predictions.filter(p => {
    if (p.evaluated || !p.next_game.date) return false;
    
    const gameDate = new Date(p.next_game.date);
    return gameDate < oneDayAgo; // Game was at least 1 day ago
  });
}

/**
 * Find prediction by player and game date
 */
export function findPredictionByGame(playerName, gameDate) {
  const data = loadPredictions();
  return data.predictions.find(p => 
    p.player_name.toLowerCase() === playerName.toLowerCase() &&
    p.next_game.date === gameDate &&
    !p.evaluated
  );
}

/**
 * Export predictions for fine-tuning (OpenAI format)
 * @param {number} minAccuracy - Minimum accuracy threshold (default: 70)
 * @param {string} model - Model to fine-tune: 'gpt-4o-mini' or 'gpt-4o' (default: 'gpt-4o-mini')
 */
export function exportForFineTuning(minAccuracy = 70, model = 'gpt-4o-mini') {
  const data = loadPredictions();
  const evaluated = data.predictions.filter(p => 
    p.evaluated && 
    p.accuracy >= minAccuracy &&
    p.method === 'chatgpt_model'
  );
  
  if (evaluated.length === 0) {
    return { message: 'No high-quality predictions available for fine-tuning' };
  }
  
  // Format for OpenAI fine-tuning (conversation format)
  const trainingData = evaluated.map(pred => {
    // Reconstruct the prompt (simplified - you'd need the full prompt)
    // Note: In production, you'd want to store the full prompt with each prediction
    const prompt = `Predict points for ${pred.player_name} based on game history.`;
    
    // Create the expected response format
    const response = {
      prediction: {
        predicted_points: pred.predicted_points,
        confidence: pred.confidence,
        error_margin: pred.error_margin
      }
    };
    
    return {
      messages: [
        {
          role: "system",
          content: "You are an expert NBA data scientist."
        },
        {
          role: "user",
          content: prompt
        },
        {
          role: "assistant",
          content: JSON.stringify(response)
        }
      ]
    };
  });
  
  return {
    count: trainingData.length,
    format: 'openai_fine_tuning',
    model: model,
    data: trainingData,
    filename: `fine_tuning_data_${model}_${Date.now()}.jsonl`,
    recommended_model: model === 'gpt-4o-mini' 
      ? 'Recommended: Start with gpt-4o-mini for cost efficiency. Upgrade to gpt-4o if accuracy needs improvement.'
      : 'Using gpt-4o for maximum accuracy. Higher cost but better performance.'
  };
}

console.log('✅ Prediction tracking service initialized');

