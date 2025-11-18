# 🎯 Quick Start: Training Your AI Prediction Model

## Overview

Your system automatically tracks all predictions. To train the AI model, you need to:
1. ✅ **Collect predictions** (already happening automatically)
2. ✅ **Evaluate predictions** (compare to actual game results)
3. ✅ **Export training data** (format for OpenAI fine-tuning)
4. ✅ **Fine-tune the model** (train on your data)

---

## Step 1: Check Your Current Data

See how many predictions you have and their accuracy:

```bash
# Make sure backend is running first!
curl http://localhost:5001/api/player/tracking/stats

# Pretty print the JSON response (optional)
curl http://localhost:5001/api/player/tracking/stats | python3 -m json.tool
```

**Note:** All commands below assume you're in the project directory. You can copy/paste them as-is.

This shows:
- Total predictions made
- How many have been evaluated
- Average accuracy and error
- Success rates

---

## Step 2: Evaluate Pending Predictions

After games are played, evaluate your predictions:

### Option A: Via API (Quick Test)
```bash
curl -X POST http://localhost:5001/api/player/tracking/evaluate
```

### Option B: Via Script (Recommended)
```bash
cd /Applications/Project/backend && npm run evaluate
```

**Or run the script directly:**
```bash
cd /Applications/Project/backend && node scripts/evaluatePredictions.js
```

This will:
- Find all predictions for games that have been played
- Fetch actual results from NBA.com
- Calculate accuracy and error
- Update your prediction database

---

## Step 3: Check Pending Evaluations

See which predictions need evaluation:

```bash
curl http://localhost:5001/api/player/tracking/pending

# Pretty print (optional)
curl http://localhost:5001/api/player/tracking/pending | python3 -m json.tool
```

This shows predictions waiting for actual game results (games that have been played but not yet evaluated).

---

## Step 4: Export Training Data

Once you have **50+ high-quality predictions** (accuracy ≥ 70%), export them:

### For GPT-4o-mini (Recommended - Cheaper)
```bash
cd /Applications/Project/backend && curl "http://localhost:5001/api/player/tracking/export?minAccuracy=75&model=gpt-4o-mini" > training_data_mini.json
```

### For GPT-4o (Maximum Accuracy)
```bash
cd /Applications/Project/backend && curl "http://localhost:5001/api/player/tracking/export?minAccuracy=75&model=gpt-4o" > training_data_4o.json
```

**Parameters:**
- `minAccuracy`: Minimum accuracy % (default: 70)
- `model`: `gpt-4o-mini` or `gpt-4o` (default: `gpt-4o-mini`)

**Verify the export:**
```bash
cd /Applications/Project/backend && cat training_data_mini.json | grep -o '"count":[0-9]*'
```

---

## Step 5: Prepare Data for OpenAI

Convert the JSON to JSONL format (one JSON object per line):

**Option A: Use the conversion script (recommended):**
```bash
cd /Applications/Project/backend && node convert_to_jsonl.js training_data_mini.json training_data_mini.jsonl
```

**Option B: Manual conversion:**
```bash
cd /Applications/Project/backend && node -e "
const data = require('./training_data_mini.json');
const fs = require('fs');
if (!data.data) {
  console.error('❌ Error: File missing data array. Re-export the data.');
  process.exit(1);
}
const jsonl = data.data.map(JSON.stringify).join('\n');
fs.writeFileSync('training_data_mini.jsonl', jsonl);
console.log('✅ Created training_data_mini.jsonl with', data.data.length, 'examples');
"
```

**Verify the JSONL file:**
```bash
# Check first line
cd /Applications/Project/backend && head -1 training_data_mini.jsonl

# Count lines (should match the count from export)
cd /Applications/Project/backend && wc -l training_data_mini.jsonl
```

---

## Step 6: Fine-Tune with OpenAI

### Prerequisites
1. Install OpenAI CLI: 
   ```bash
   # Option 1: Using pip (Python)
   pip install openai
   
   # Option 2: Using npm (Node.js)
   npm install -g openai-cli
   ```

2. Set your API key:
   ```bash
   export OPENAI_API_KEY=your_key_here
   ```

### Fine-Tune GPT-4o-mini (Recommended)
```bash
cd /Applications/Project/backend && openai api fine_tuning.jobs.create \
  -t training_data_mini.jsonl \
  -m gpt-4o-mini \
  --hyperparameters n_epochs=3
```

### Fine-Tune GPT-4o (If you want maximum accuracy)
```bash
cd /Applications/Project/backend && openai api fine_tuning.jobs.create \
  -t training_data_4o.jsonl \
  -m gpt-4o \
  --hyperparameters n_epochs=3
```

**Note:** The command will return a job ID. Save this ID to monitor the training.

### Monitor Training
```bash
# Replace <job_id> with the ID from the create command
# List all fine-tuning jobs
cd /Applications/Project/backend && openai api fine_tuning.jobs.list

# Get status of a specific job
cd /Applications/Project/backend && openai api fine_tuning.jobs.retrieve -i <job_id>

# List events for a specific job (shows training progress)
cd /Applications/Project/backend && openai api fine_tuning.jobs.list_events -i <job_id>
```

---

## Step 7: Use Your Fine-Tuned Model

Once training completes, get the fine-tuned model name:

```bash
# Replace <job_id> with your job ID from step 6
cd /Applications/Project/backend && openai api fine_tuning.jobs.retrieve -i <job_id>
```

The response will include a `fine_tuned_model` field with the model name (e.g., `ft:gpt-4o-mini:your-org:custom-model-name:abc123`).

Then update `backend/services/predictionService.js`:

```javascript
// Find this line (around line 250):
model: "gpt-4o-mini",

// Replace with your fine-tuned model name:
model: "ft:gpt-4o-mini:your-org:custom-model-name:abc123",
```

---

## Recommended Schedule

- **Daily**: Run `npm run evaluate` to update predictions
- **Weekly**: Check stats and review accuracy patterns
- **Monthly**: Export data if you have 50+ good predictions
- **Quarterly**: Fine-tune model with accumulated data

---

## Which Model Should I Use?

### Start with GPT-4o-mini ✅
- **10-20x cheaper** than GPT-4o
- **Sufficient** for structured prediction tasks
- **Faster iteration** - experiment more with lower costs
- Fine-tuned mini can match base GPT-4o for specific tasks

### Use GPT-4o if:
- You need maximum accuracy regardless of cost
- You want consistency with current GPT-4o predictions
- You plan to add more complex reasoning later

**Cost Comparison:**
- GPT-4o-mini: ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- GPT-4o: ~$2.50 per 1M input tokens, ~$10 per 1M output tokens

---

## Troubleshooting

### "No predictions found"
- Make sure you've viewed some player predictions on the website
- Check that `backend/data/predictions.json` exists

### "Evaluation failing"
- Check NBA.com API access (may be rate-limited)
- Verify player names match exactly
- Ensure game dates are correct

### "Low accuracy"
- Review error patterns (consistently high/low?)
- Check if certain player types are problematic
- May need more training data (aim for 50+ examples)

---

## Next Steps

1. **Start collecting**: View predictions on the website
2. **Wait for games**: Let some games finish
3. **Evaluate**: Run `npm run evaluate`
4. **Check stats**: Review accuracy
5. **Export when ready**: Once you have 50+ good predictions
6. **Fine-tune**: Train your custom model

For more details, see `TRAINING.md`.

