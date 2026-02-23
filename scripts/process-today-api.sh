#!/bin/bash
# Process today's events via API endpoint

SECRET=$(grep X_DF_JOBS_SECRET .env.local | cut -d'=' -f2 | tr -d '\n')

if [ -z "$SECRET" ]; then
  echo "Error: X_DF_JOBS_SECRET not found in .env.local"
  exit 1
fi

echo "Processing today's events..."
echo "Secret found: ${SECRET:0:10}..."

# Process in batches (each call processes up to 100 events)
for i in {1..10}; do
  echo ""
  echo "Batch $i:"
  RESPONSE=$(curl -s -X POST "https://df-middleware.vercel.app/api/jobs/process-pending" \
    -H "Authorization: Bearer $SECRET" \
    -H "Content-Type: application/json")
  
  PROCESSED=$(echo $RESPONSE | jq -r '.processed // 0')
  ERRORS=$(echo $RESPONSE | jq -r '.errors // 0')
  REMAINING=$(echo $RESPONSE | jq -r '.totalPending // 0')
  
  echo "  Processed: $PROCESSED, Errors: $ERRORS, Remaining: $REMAINING"
  
  if [ "$PROCESSED" = "0" ] || [ "$REMAINING" = "0" ]; then
    echo "No more events to process!"
    break
  fi
  
  sleep 1
done

echo ""
echo "Done!"
