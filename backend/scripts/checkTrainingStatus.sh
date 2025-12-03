#!/bin/bash

# Check fine-tuning job status
# Usage: ./scripts/checkTrainingStatus.sh [job_id]

cd "$(dirname "$0")/.."
export $(grep -v '^#' .env | xargs)

JOB_ID=${1:-"ftjob-g467dFZNZuf2orwt2fYozhvB"}

echo "🔍 Checking fine-tuning job status..."
echo "Job ID: $JOB_ID"
echo ""

openai api fine_tuning.jobs.retrieve -i "$JOB_ID" | python3 -m json.tool

echo ""
echo "📊 Recent events:"
openai api fine_tuning.jobs.list_events -i "$JOB_ID" | python3 -m json.tool | head -30





