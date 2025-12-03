import OpenAI from 'openai';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function convertAndUploadTrainingFile() {
  try {
    const inputFile = '/Users/tylercary/Downloads/nba_finetune_750.jsonl';
    const outputFile = path.join(__dirname, '../nba_finetune_750_converted.jsonl');
    
    console.log('📖 Reading training file...');
    const fileContent = fs.readFileSync(inputFile, 'utf-8');
    const lines = fileContent.trim().split('\n');
    
    console.log(`📊 Found ${lines.length} training examples`);
    
    // Convert format if needed
    const converted = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      try {
        const example = JSON.parse(line);
        
        // Check if it's already in the correct format
        if (example.messages && Array.isArray(example.messages)) {
          // Check if last message is assistant or if there's a separate completion
          if (example.completion) {
            // Convert from old format to new format
            const messages = [...example.messages];
            messages.push({
              role: 'assistant',
              content: example.completion.content || example.completion
            });
            converted.push({ messages });
          } else if (example.messages[example.messages.length - 1].role === 'assistant') {
            // Already in correct format
            converted.push(example);
          } else {
            console.warn(`⚠️  Line ${i + 1}: Missing assistant message, skipping`);
          }
        } else {
          console.warn(`⚠️  Line ${i + 1}: Invalid format, skipping`);
        }
      } catch (parseError) {
        console.error(`❌ Error parsing line ${i + 1}:`, parseError.message);
      }
    }
    
    console.log(`✅ Converted ${converted.length} examples`);
    
    // Write converted file
    const outputContent = converted.map(ex => JSON.stringify(ex)).join('\n');
    fs.writeFileSync(outputFile, outputContent);
    console.log(`💾 Saved converted file to: ${outputFile}`);
    
    // Upload to OpenAI
    console.log('📤 Uploading training file to OpenAI...');
    const file = await openai.files.create({
      file: fs.createReadStream(outputFile),
      purpose: 'fine-tune'
    });
    
    console.log(`✅ File uploaded! File ID: ${file.id}`);
    console.log(`📋 File details:`);
    console.log(`   - ID: ${file.id}`);
    console.log(`   - Purpose: ${file.purpose}`);
    console.log(`   - Bytes: ${file.bytes}`);
    
    return file.id;
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

async function createFineTuningJob(trainingFileId) {
  try {
    console.log('\n🚀 Creating fine-tuning job...');
    
    const job = await openai.fineTuning.jobs.create({
      training_file: trainingFileId,
      model: 'gpt-3.5-turbo-0125',
      hyperparameters: {
        n_epochs: 3,
        batch_size: 4,
        learning_rate_multiplier: 1.0
      }
    });
    
    console.log(`✅ Fine-tuning job created!`);
    console.log(`📋 Job details:`);
    console.log(`   - Job ID: ${job.id}`);
    console.log(`   - Status: ${job.status}`);
    console.log(`   - Model: ${job.model}`);
    console.log(`   - Training File: ${job.training_file}`);
    console.log(`\n💡 Monitor progress with:`);
    console.log(`   openai api fine_tuning.jobs.retrieve ${job.id}`);
    console.log(`\n📝 Or check status in OpenAI dashboard:`);
    console.log(`   https://platform.openai.com/finetune`);
    
    return job.id;
  } catch (error) {
    console.error('❌ Error creating fine-tuning job:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🏀 Starting new fine-tuned model creation...\n');
    
    // Step 1: Convert and upload file
    const fileId = await convertAndUploadTrainingFile();
    
    // Step 2: Create fine-tuning job
    const jobId = await createFineTuningJob(fileId);
    
    console.log('\n✅ All done! Your fine-tuning job is running.');
    console.log(`\n📌 IMPORTANT: Save this job ID: ${jobId}`);
    console.log(`   You'll need it to update the model ID in predictionService.js once training completes.`);
    console.log(`\n⏱️  Training typically takes 10-30 minutes. Check status with:`);
    console.log(`   openai api fine_tuning.jobs.retrieve ${jobId}`);
    
  } catch (error) {
    console.error('\n❌ Failed to create fine-tuning job:', error.message);
    process.exit(1);
  }
}

main();





