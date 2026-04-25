#!/bin/bash

# Kling 3 Pro Motion Control - API Testing Examples
# This script contains curl examples for testing the motion control API

# Set your configuration
BACKEND_URL="http://localhost:4000/api"
FREEPIK_API_KEY="your_api_key_here"
CHARACTER_IMAGE_URL="https://example.com/character.png"
REFERENCE_VIDEO_URL="https://example.com/reference.mp4"
WEBHOOK_URL="https://your-server.com/webhook"

echo "=== Kling 3 Pro Motion Control API Testing ==="
echo ""

# 1. Health Check
echo "1️⃣  Health Check"
echo "   Verifying backend is running..."
curl -s -X GET "$BACKEND_URL/health" | jq '.'
echo ""

# 2. Generate Motion Control Video
echo "2️⃣  Generate Motion Control Video"
echo "   Creating motion control task..."
curl -s -X POST "$BACKEND_URL/video/generate" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"kling-v3-motion-pro\",
    \"image_url\": \"$CHARACTER_IMAGE_URL\",
    \"video_url\": \"$REFERENCE_VIDEO_URL\",
    \"prompt\": \"Transfer smooth, dynamic motion while maintaining character appearance\",
    \"character_orientation\": \"video\",
    \"cfg_scale\": 0.5,
    \"webhook_url\": \"$WEBHOOK_URL\",
    \"apiKey\": \"$FREEPIK_API_KEY\"
  }" | jq '.'

echo ""
echo "💾 Save the taskId from the response above"
echo ""

# 3. Check Task Status (replace TASK_ID with actual task ID)
TASK_ID="paste-your-task-id-here"
echo "3️⃣  Check Task Status"
echo "   Checking status for task: $TASK_ID"
curl -s -X GET "$BACKEND_URL/video/tasks/$TASK_ID?model=kling-v3-motion-pro" | jq '.'
echo ""

# 4. List Saved Assets
echo "4️⃣  List Saved Assets"
echo "   Retrieving asset library..."
curl -s -X GET "$BACKEND_URL/assets" | jq '.'
echo ""

# 5. Save Generated Video
echo "5️⃣  Save Video to Library"
echo "   Saving video asset..."
curl -s -X POST "$BACKEND_URL/assets/save" \
  -H "Content-Type: application/json" \
  -d "{
    \"taskId\": \"$TASK_ID\",
    \"prompt\": \"Motion control example video\",
    \"model\": \"kling-v3-motion-pro\",
    \"aspectRatio\": \"16:9\",
    \"duration\": \"5\",
    \"videoUrl\": \"https://example.com/generated.mp4\",
    \"sourceKind\": \"Motion control\",
    \"sourceImageUrl\": \"$CHARACTER_IMAGE_URL\"
  }" | jq '.'
echo ""

echo "=== API Testing Complete ==="
echo ""
echo "📝 Notes:"
echo "  - Replace TASK_ID with actual task ID from step 2"
echo "  - Replace URLs with your actual image/video URLs"
echo "  - Ensure backend is running on http://localhost:4000"
echo "  - Install jq for pretty JSON formatting: npm install -g jq"
