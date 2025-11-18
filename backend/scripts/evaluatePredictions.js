#!/usr/bin/env node

/**
 * Standalone script to automatically evaluate pending predictions
 * Can be run manually or scheduled via cron
 * 
 * Usage:
 *   node scripts/evaluatePredictions.js
 * 
 * Or add to crontab to run daily:
 *   0 2 * * * cd /path/to/project/backend && node scripts/evaluatePredictions.js >> logs/evaluation.log 2>&1
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../.env') });

// Import after env is loaded
const { evaluatePendingPredictions } = await import('../services/predictionEvaluationService.js');

async function main() {
  console.log('='.repeat(60));
  console.log('🏀 HoopForecast v2 - Automatic Prediction Evaluation');
  console.log('='.repeat(60));
  console.log(`Started at: ${new Date().toISOString()}\n`);
  
  try {
    const results = await evaluatePendingPredictions();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 Evaluation Summary:');
    console.log('='.repeat(60));
    console.log(`✅ Evaluated: ${results.evaluated}`);
    console.log(`❌ Failed: ${results.failed}`);
    console.log(`⏭️  Skipped: ${results.skipped}`);
    console.log(`📈 Total: ${results.evaluated + results.failed + results.skipped}`);
    
    if (results.results.length > 0) {
      console.log('\n📋 Results:');
      results.results.forEach((result, index) => {
        if (result.status === 'evaluated') {
          console.log(`  ${index + 1}. ${result.player}: Predicted ${result.predicted} → Actual ${result.actual} (Error: ${result.error.toFixed(1)}, Accuracy: ${result.accuracy}%)`);
        } else if (result.status === 'failed') {
          console.log(`  ${index + 1}. ${result.player}: ❌ ${result.error}`);
        } else {
          console.log(`  ${index + 1}. ${result.player}: ⏭️  ${result.reason}`);
        }
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`Completed at: ${new Date().toISOString()}`);
    console.log('='.repeat(60));
    
    // Exit with appropriate code
    process.exit(results.failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('\n❌ Fatal error during evaluation:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the script
main();


