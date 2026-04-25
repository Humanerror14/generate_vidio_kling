# Motion Control API - Example Payloads & Responses

## Request Examples

### 1. Basic Motion Control Request

```json
{
  "model": "kling-v3-motion-pro",
  "image_url": "https://example.com/character.png",
  "video_url": "https://example.com/reference.mp4",
  "character_orientation": "video",
  "cfg_scale": 0.5
}
```

### 2. Motion Control with Prompt

```json
{
  "model": "kling-v3-motion-pro",
  "image_url": "https://example.com/character.png",
  "video_url": "https://example.com/reference.mp4",
  "prompt": "Apply smooth cinematic motion with subtle camera drift and dynamic depth",
  "character_orientation": "video",
  "cfg_scale": 0.7
}
```

### 3. Motion Control with Webhook

```json
{
  "model": "kling-v3-motion-pro",
  "image_url": "https://example.com/character.png",
  "video_url": "https://example.com/reference.mp4",
  "prompt": "Transfer energetic dance motion while maintaining elegant pose",
  "character_orientation": "image",
  "cfg_scale": 0.5,
  "webhook_url": "https://your-app.com/webhooks/freepik"
}
```

### 4. Data URL Upload (Base64)

```json
{
  "model": "kling-v3-motion-pro",
  "image_url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "video_url": "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc29maXNvYXZj...",
  "character_orientation": "video",
  "cfg_scale": 0.5
}
```

## Response Examples

### 1. Success Response - Task Created

```json
{
  "success": true,
  "model": "kling-v3-motion-pro",
  "requestedModel": "kling-v3-motion-pro",
  "modelLabel": "Kling 3 Motion Control Pro",
  "taskId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "CREATED",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "CREATED",
    "created_at": "2026-04-25T10:30:00Z",
    "request": {
      "image_url": "https://example.com/character.png",
      "video_url": "https://example.com/reference.mp4",
      "character_orientation": "video",
      "cfg_scale": 0.5
    }
  }
}
```

### 2. Task Status - Processing

```json
{
  "success": true,
  "model": "kling-v3-motion-pro",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "PROCESSING",
    "created_at": "2026-04-25T10:30:00Z",
    "updated_at": "2026-04-25T10:31:30Z",
    "progress": 45
  }
}
```

### 3. Task Status - Completed

```json
{
  "success": true,
  "model": "kling-v3-motion-pro",
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "COMPLETED",
    "created_at": "2026-04-25T10:30:00Z",
    "completed_at": "2026-04-25T10:35:45Z",
    "video_url": "https://cdn.freepik.com/videos/generated/550e8400-e29b-41d4-a716-446655440000.mp4",
    "duration": 5,
    "width": 1280,
    "height": 720
  }
}
```

### 4. Error Response - Invalid Input

```json
{
  "error": "Motion Control Pro requires both image_url and video_url",
  "details": {
    "invalid_params": [
      {
        "name": "video_url",
        "reason": "Parameter 'video_url' is required"
      }
    ]
  }
}
```

### 5. Error Response - Invalid URL

```json
{
  "error": "Invalid image_url: resource not accessible",
  "statusCode": 400
}
```

### 6. Error Response - API Limit

```json
{
  "error": "Monthly quota exceeded. Please upgrade your plan.",
  "statusCode": 429
}
```

## Status Values

| Status | Meaning | Action |
|--------|---------|--------|
| CREATED | Task created successfully | Wait for processing |
| QUEUED | Task waiting in queue | Continue polling |
| SUBMITTING | Sending to generation engine | Continue polling |
| PROCESSING | Video generation in progress | Continue polling |
| COMPLETED | Video ready | Download or save |
| FAILED | Generation failed | Check error details |
| CANCELLED | Task cancelled | Retry if needed |

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (invalid parameters) |
| 401 | Unauthorized (invalid API key) |
| 404 | Not Found (task doesn't exist) |
| 429 | Too Many Requests (quota exceeded) |
| 500 | Server Error |

## Polling Strategy

### Recommended Polling Pattern

```javascript
async function pollTaskStatus(taskId, model) {
  const maxAttempts = 120; // 10 minutes max
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(
        `/api/video/tasks/${taskId}?model=${model}`
      );
      const data = await response.json();

      if (["COMPLETED", "FAILED", "CANCELLED"].includes(data.data.status)) {
        return data;
      }

      attempts++;
      // Wait 5 seconds before next poll
      await new Promise(resolve => setTimeout(resolve, 5000));

    } catch (error) {
      console.error("Polling error:", error);
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  throw new Error("Task polling timeout");
}
```

### Webhook Notification Example

When using webhook_url, Freepik will POST:

```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "COMPLETED",
  "video_url": "https://cdn.freepik.com/videos/generated/550e8400-e29b-41d4-a716-446655440000.mp4",
  "created_at": "2026-04-25T10:30:00Z",
  "completed_at": "2026-04-25T10:35:45Z"
}
```

## Asset Management Examples

### Save Asset Response

```json
{
  "success": true,
  "deduplicated": false,
  "asset": {
    "id": "abc123def456",
    "title": "motion-control-demo",
    "prompt": "Apply smooth cinematic motion",
    "taskId": "550e8400-e29b-41d4-a716-446655440000",
    "model": "kling-v3-motion-pro",
    "aspectRatio": "16:9",
    "duration": "5",
    "sourceKind": "Motion control",
    "sourceImageUrl": "https://example.com/character.png",
    "remoteVideoUrl": "https://cdn.freepik.com/videos/generated/550e8400-e29b-41d4-a716-446655440000.mp4",
    "fileName": "motion-control-demo-abc123de.mp4",
    "contentType": "video/mp4",
    "sizeBytes": 5242880,
    "savedAt": "2026-04-25T10:36:00Z",
    "streamUrl": "/api/assets/abc123def456/stream",
    "downloadUrl": "/api/assets/abc123def456/download"
  }
}
```

### Asset Library Response

```json
{
  "success": true,
  "assets": [
    {
      "id": "abc123def456",
      "title": "motion-control-demo",
      "prompt": "Apply smooth cinematic motion",
      "taskId": "550e8400-e29b-41d4-a716-446655440000",
      "model": "kling-v3-motion-pro",
      "aspectRatio": "16:9",
      "duration": "5",
      "sourceKind": "Motion control",
      "sourceImageUrl": "https://example.com/character.png",
      "remoteVideoUrl": "https://cdn.freepik.com/videos/generated/550e8400-e29b-41d4-a716-446655440000.mp4",
      "fileName": "motion-control-demo-abc123de.mp4",
      "contentType": "video/mp4",
      "sizeBytes": 5242880,
      "savedAt": "2026-04-25T10:36:00Z",
      "streamUrl": "/api/assets/abc123def456/stream",
      "downloadUrl": "/api/assets/abc123def456/download"
    }
  ]
}
```

## Testing Checklist

- [ ] Backend running on port 4000
- [ ] Frontend running on port 3000
- [ ] API key properly configured
- [ ] Image URL is publicly accessible
- [ ] Video URL is publicly accessible
- [ ] Character orientation selected
- [ ] CFG scale between 0-1
- [ ] Task ID retrieved from generation request
- [ ] Status polling returns COMPLETED
- [ ] Video URL present in response
- [ ] Video asset saved successfully
- [ ] Download works correctly
