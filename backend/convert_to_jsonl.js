#!/usr/bin/env node

/**
 * Convert training data JSON to JSONL format for OpenAI fine-tuning
 * Usage: node convert_to_jsonl.js [input_file] [output_file]
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get input and output file names
const inputFile = process.argv[2] || 'training_data_mini.json';
const outputFile = process.argv[3] || 'training_data_mini.jsonl';

// Check if input file exists
if (!fs.existsSync(inputFile)) {
  console.error(`❌ Error: File "${inputFile}" not found`);
  console.error(`   Make sure you're in the backend directory and the file exists`);
  process.exit(1);
}

// Read the JSON file
let data;
try {
  const fileContent = fs.readFileSync(inputFile, 'utf8');
  data = JSON.parse(fileContent);
} catch (error) {
  console.error(`❌ Error reading/parsing JSON file:`, error.message);
  process.exit(1);
}

// Check if data array exists (new format) or preview (old format)
let trainingData = null;

if (data.data && Array.isArray(data.data)) {
  // New format: has full data array
  trainingData = data.data;
  console.log(`✅ Found full data array with ${trainingData.length} examples`);
} else if (data.preview && Array.isArray(data.preview)) {
  // Old format: only has preview
  console.warn(`⚠️  Warning: File only contains preview (${data.preview.length} examples)`);
  console.warn(`   You need to re-export the data to get the full dataset`);
  console.warn(`   Run: curl "http://localhost:5001/api/player/tracking/export?minAccuracy=75&model=gpt-4o-mini" > ${inputFile}`);
  trainingData = data.preview; // Use preview as fallback
} else {
  console.error(`❌ Error: Could not find data array or preview in JSON file`);
  console.error(`   File structure:`, Object.keys(data));
  process.exit(1);
}

// Convert to JSONL (one JSON object per line)
const jsonl = trainingData.map(JSON.stringify).join('\n');

// Write to output file
try {
  fs.writeFileSync(outputFile, jsonl, 'utf8');
  console.log(`✅ Created ${outputFile} with ${trainingData.length} examples`);
  console.log(`   File size: ${(jsonl.length / 1024).toFixed(2)} KB`);
} catch (error) {
  console.error(`❌ Error writing JSONL file:`, error.message);
  process.exit(1);
}

