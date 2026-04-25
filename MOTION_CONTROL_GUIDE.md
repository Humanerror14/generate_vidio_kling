# Kling 3 Pro Motion Control Video - Complete Guide

This guide covers the end-to-end implementation of Kling 3 Pro Motion Control video generation using the Freepik API.

## 📋 Overview

The **Kling 3 Pro Motion Control** feature allows you to transfer motion from a reference video to a character image while preserving the character's appearance. The model intelligently applies motion patterns while maintaining visual consistency.

### Key Capabilities
- **Motion Transfer**: Apply motion patterns from reference videos to character images
- **Appearance Preservation**: Keep character details intact while changing motion
- **Flexible Control**: Adjust character orientation and motion strength
- **Async Processing**: Background video generation with webhook support

## 🏗️ Architecture

### Backend (Express.js)
- **API Proxy**: Routes requests to Freepik API
- **Model Registry**: Manages multiple video generation models
- **Asset Storage**: Local file storage for generated videos
- **Webhook Handler**: Receives async notifications from Freepik

### Frontend (Next.js + React)
- **Motion Control Form**: Dedicated UI component for motion control settings
- **File Upload**: Handle image and video uploads with validation
- **Task Polling**: Monitor video generation progress
- **Asset Library**: Display and manage saved videos

### API Utilities
- **motion-control-api.ts**: Motion control request/response handling
- **file-utils.ts**: File validation and processing

## 🚀 Setup Instructions

### Prerequisites
1. **Freepik API Key** - Get it from [https://www.freepik.com/developers/dashboard](https://www.freepik.com/developers/dashboard)
2. **Node.js** 18+ installed
3. **Git** for version control

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cat > .env << EOF
PORT=4000
FREEPIK_API_BASE_URL=https://api.freepik.com
FREEPIK_API_KEY=your_api_key_here
CORS_ORIGIN=http://localhost:3000
EOF

# Start development server
npm run dev
```

Backend will run on `http://localhost:4000`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Create .env.local file
cat > .env.local << EOF
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api
EOF

# Start development server
npm run dev
```

Frontend will run on `http://localhost:3000`

## 📝 How to Use Motion Control

### 1. **Select Model**
Choose "Kling 3 Pro Motion Control" from the model selection panel.

### 2. **Upload Character Image**
- Click the image upload area or drag & drop
- Supported formats: JPG, JPEG, PNG, WEBP
- Minimum resolution: 300x300 pixels
- Maximum file size: 10MB

### 3. **Upload Reference Video**
- Click the video upload area or provide a URL
- Supported formats: MP4, MOV, WEBM, M4V
- Duration: 3-30 seconds
- Maximum file size: 20MB

### 4. **Configure Motion Settings**

#### Reference Mode
- **Motion**: Video follows motion patterns from reference
- **Style**: Video follows visual appearance/colors from reference

#### Character Orientation
- **Match Video**: Orientation matches reference video (best for complex motion, up to 30s)
- **Match Image**: Orientation matches character image (best for camera movement, up to 10s)

#### Motion Strength
- Slider from 0-10
- Higher values = more intense motion from reference
- Default: 5

### 5. **Optional Settings**
- **Prompt**: Additional text guidance (up to 2500 characters)
- **CFG Scale**: Controls prompt adherence (0-1, default 0.5)
- **Webhook URL**: Receive async notifications

### 6. **Generate & Monitor**
1. Click "Generate video"
2. Monitor progress in the status panel
3. Polling automatically checks status every 5 seconds
4. Video appears when generation completes

### 7. **Save & Download**
1. Click "Simpan ke asset library" to save locally
2. Click "Download video" to save to your computer
3. Access saved videos in the Asset Library section

## 🔌 API Endpoints

### Generate Motion Control Video

```
POST /api/video/generate
Content-Type: application/json
```

**Request Body:**
```json
{
  "model": "kling-v3-motion-pro",
  "image_url": "https://...",
  "video_url": "https://...",
  "prompt": "Optional direction for the motion",
  "character_orientation": "video",
  "cfg_scale": 0.5,
  "webhook_url": "https://your-server.com/webhook"
}
```

**Response:**
```json
{
  "success": true,
  "taskId": "task-id-uuid",
  "status": "CREATED",
  "model": "kling-v3-motion-pro"
}
```

### Check Task Status

```
GET /api/video/tasks/{taskId}?model=kling-v3-motion-pro
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "COMPLETED",
    "video_url": "https://...",
    "task_id": "task-id-uuid"
  }
}
```

### Webhook Handler

```
POST /api/webhooks/freepik
```

Freepik will POST to this endpoint when a task completes (if webhook_url was provided).

## 📁 File Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx              # Main page with all UI
│   │   └── globals.css           # Global styles
│   ├── components/
│   │   └── MotionControlForm.tsx # Motion control form component
│   ├── lib/
│   │   ├── motion-control-api.ts # Motion control utilities
│   │   └── file-utils.ts         # File validation & processing
│   └── ...
└── ...

backend/
├── src/
│   └── index.js                  # Express server with all endpoints
├── storage/
│   ├── data/
│   │   └── assets.json           # Asset metadata
│   └── videos/                   # Generated video files
├── .env                          # Environment variables
└── package.json
```

## 🔄 Request/Response Flow

```
1. User selects kling-v3-motion-pro model
2. User uploads character image & reference video
3. Frontend sends POST /api/video/generate
4. Backend validates inputs & forwards to Freepik API
5. Freepik returns task_id
6. Frontend polls GET /api/video/tasks/{taskId}
7. Status updates: CREATED → QUEUED → PROCESSING → COMPLETED
8. When complete, video_url is available
9. User saves to local library or downloads
```

## 🎛️ Configuration

### Environment Variables

**Backend (.env)**
```
PORT=4000                                          # Backend port
FREEPIK_API_BASE_URL=https://api.freepik.com    # Freepik API URL
FREEPIK_API_KEY=sk_...                           # Your API key
CORS_ORIGIN=http://localhost:3000                # Frontend origin
```

**Frontend (.env.local)**
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api  # Backend API URL
```

## 📊 Motion Control Parameters

| Parameter | Type | Range | Default | Description |
|-----------|------|-------|---------|-------------|
| image_url | URL | - | required | Character image URL |
| video_url | URL | - | required | Reference video URL |
| prompt | string | 0-2500 chars | optional | Motion guidance prompt |
| character_orientation | enum | video\|image | video | How to interpret spatial info |
| cfg_scale | float | 0-1 | 0.5 | Prompt adherence strength |
| webhook_url | URL | - | optional | Async notification URL |

## 🐛 Troubleshooting

### Image Upload Issues
- **"Image must be smaller than 10MB"**: Compress image before uploading
- **"File must be an image"**: Ensure file is JPG, PNG, or WEBP
- **"Invalid character image URL"**: Check URL is publicly accessible

### Video Upload Issues
- **"Video must be 3-30 seconds"**: Trim video to required length
- **"Video must be smaller than 20MB"**: Compress video file
- **"Failed to load video"**: Browser cannot read file format

### Generation Errors
- **"Motion Control Pro requires image and video"**: Upload both files
- **"Limit reached"**: API quota exceeded, use different key
- **"Backend offline"**: Ensure backend is running on port 4000

### Model Selection
- **Motion Control Pro not showing**: Update model catalog in page.tsx
- **Model mismatch errors**: Verify model name matches backend registry

## 🔐 Security Best Practices

1. **API Keys**: Store in .env files, never commit to git
2. **CORS**: Configure CORS_ORIGIN for your domain
3. **Input Validation**: All files validated before upload
4. **Webhooks**: Consider adding signature verification
5. **Storage**: Implement cleanup for old videos

## 📈 Performance Tips

1. **Image Size**: Keep images under 5MB for faster processing
2. **Video Duration**: Shorter videos (3-10s) process faster
3. **Resolution**: Use 16:9 aspect ratio for best results
4. **Polling**: Frontend polls every 5 seconds automatically
5. **Webhook**: Use webhook_url for real-time notifications instead of polling

## 🎨 UI Customization

### Motion Control Form Component
Located in `frontend/src/components/MotionControlForm.tsx`

Customize:
- Colors and styling in tailwind classes
- Info messages and descriptions
- Slider ranges and defaults
- Upload area appearance

### Main Page
Located in `frontend/src/app/page.tsx`

Customize:
- Header copy and descriptions
- Button labels and colors
- Layout and spacing
- Asset library display

## 📚 Related Documentation

- **Freepik API Docs**: https://docs.freepik.com/api-reference
- **Kling 3 Pro**: https://docs.freepik.com/api-reference/video
- **Next.js**: https://nextjs.org/docs
- **Express**: https://expressjs.com/

## 🤝 Contributing

To contribute improvements:
1. Create a feature branch
2. Test thoroughly with motion control feature
3. Update documentation if needed
4. Submit pull request

## 📄 License

This implementation is provided as-is for use with the Freepik API.

## 🆘 Support

For issues:
1. Check Freepik API status: https://www.freepik.com/developers
2. Review error messages carefully
3. Check console logs in browser and backend
4. Verify all files are properly configured
