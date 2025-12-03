import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const JOB_ID = process.argv[2] || 'ftjob-6e3YeQMl3BYokiF5Xz3zFbkU';

async function checkStatus() {
  try {
    console.log(`📊 Checking fine-tuning job status: ${JOB_ID}\n`);
    
    const job = await openai.fineTuning.jobs.retrieve(JOB_ID);
    
    console.log(`Status: ${job.status}`);
    console.log(`Model: ${job.model}`);
    console.log(`Training File: ${job.training_file}`);
    
    if (job.fine_tuned_model) {
      console.log(`\n✅ Fine-tuned Model ID: ${job.fine_tuned_model}`);
      console.log(`\n📝 Update predictionService.js with this model ID:`);
      console.log(`   model: "${job.fine_tuned_model}"`);
    }
    
    if (job.status === 'succeeded') {
      console.log(`\n🎉 Training completed successfully!`);
      console.log(`\n📋 Training metrics:`);
      if (job.trained_tokens) {
        console.log(`   - Trained tokens: ${job.trained_tokens}`);
      }
    } else if (job.status === 'failed') {
      console.log(`\n❌ Training failed!`);
      if (job.error) {
        console.log(`   Error: ${JSON.stringify(job.error, null, 2)}`);
      }
    } else if (job.status === 'running') {
      console.log(`\n⏳ Training in progress...`);
    } else if (job.status === 'validating_files') {
      console.log(`\n🔍 Validating training files...`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkStatus();





