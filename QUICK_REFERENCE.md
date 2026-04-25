# Kling 3 Pro Motion Control - Quick Reference

## 🚀 Quick Start (5 minutes)

### 1. Backend
```bash
cd backend
npm install
echo "PORT=4000
FREEPIK_API_KEY=your_key_here
FREEPIK_API_BASE_URL=https://api.freepik.com
CORS_ORIGIN=http://localhost:3000" > .env
npm run dev
```

### 2. Frontend
```bash
cd frontend
npm install
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api" > .env.local
npm run dev
```

### 3. Open
- Navigate to http://localhost:3000
- Login with your Freepik API key
- Select "Kling 3 Pro Motion Control"
- Upload images and videos
- Click "Generate video"

## 📋 Model Details

| Property | Value |
|----------|-------|
| **Model ID** | kling-v3-motion-pro |
| **Purpose** | Transfer motion from video to image |
| **Image Format** | JPG, PNG, WEBP |
| **Image Size** | 300x300 pixels minimum |
| **Image Max** | 10 MB |
| **Video Format** | MP4, MOV, WEBM, M4V |
| **Video Duration** | 3-30 seconds |
| **Video Max** | 20 MB |

## 🎛️ Form Parameters

```javascript
{
  // Required
  image_url: "https://...",           // Character image
  video_url: "https://...",           // Reference video
  
  // Optional
  prompt: "Motion guidance...",       // Up to 2500 chars
  character_orientation: "video",     // "video" | "image"
  cfg_scale: 0.5,                    // 0-1 (default: 0.5)
  webhook_url: "https://...",        // Async notification
}
```

## ⚙️ Character Orientation

| Option | Duration Max | Best For | Description |
|--------|--------------|----------|-------------|
| **video** | 30 seconds | Complex motion | Matches reference video orientation |
| **image** | 10 seconds | Camera movement | Matches character image orientation |

## 🎯 Reference Mode

| Mode | Use When | Result |
|------|----------|--------|
| **Motion** | ✅ You want motion patterns | Video follows movement |
| **Appearance** | ✅ You want visual style | Video follows colors/style |

## 🔄 Workflow

```
LOGIN → SELECT MODEL → UPLOAD IMAGE → UPLOAD VIDEO 
→ CONFIGURE SETTINGS → GENERATE → POLL STATUS → VIEW RESULT 
→ SAVE/DOWNLOAD
```

## 📊 Status Values

| Status | Duration | Action |
|--------|----------|--------|
| CREATED | <1 min | Starting |
| QUEUED | Variable | In queue |
| PROCESSING | 2-5 min | Generating |
| COMPLETED | Done | Download |
| FAILED | Done | Retry |

## 🔌 API Endpoints

### Generate
```bash
POST /api/video/generate
Content-Type: application/json

{
  "model": "kling-v3-motion-pro",
  "image_url": "...",
  "video_url": "...",
  "character_orientation": "video",
  "cfg_scale": 0.5
}
```

### Check Status
```bash
GET /api/video/tasks/{taskId}?model=kling-v3-motion-pro
```

### Save Asset
```bash
POST /api/assets/save
Content-Type: application/json

{
  "taskId": "...",
  "videoUrl": "...",
  "prompt": "...",
  "model": "kling-v3-motion-pro",
  "aspectRatio": "16:9",
  "duration": "5"
}
```

## 🎨 UI Components

### Files Created
- `frontend/src/components/MotionControlForm.tsx` - Motion form
- `frontend/src/lib/motion-control-api.ts` - API utilities
- `frontend/src/lib/file-utils.ts` - File handling

### Files Modified
- `frontend/src/app/page.tsx` - Integrated component
- `backend/src/index.js` - Added webhook handler

## 📁 New Documentation

| File | Purpose |
|------|---------|
| MOTION_CONTROL_GUIDE.md | Complete setup & usage guide |
| API_EXAMPLES.md | Request/response examples |
| IMPLEMENTATION_SUMMARY.md | Feature overview |
| test-api.sh | API testing script |
| QUICK_REFERENCE.md | This file |

## 🧪 Test Commands

```bash
# Health check
curl -s http://localhost:4000/api/health | jq

# Generate video
curl -X POST http://localhost:4000/api/video/generate \
  -H "Content-Type: application/json" \
  -d '{
    "model": "kling-v3-motion-pro",
    "image_url": "https://example.com/image.png",
    "video_url": "https://example.com/video.mp4",
    "character_orientation": "video",
    "cfg_scale": 0.5
  }'

# Check status (replace TASK_ID)
curl -s "http://localhost:4000/api/video/tasks/TASK_ID?model=kling-v3-motion-pro" | jq
```

## ✅ Validation Rules

### Images
- ✅ Format: JPG, PNG, WEBP
- ✅ Size: 300x300 minimum
- ✅ File size: < 10 MB
- ✅ Accessible URL

### Videos
- ✅ Format: MP4, MOV, WEBM, M4V
- ✅ Duration: 3-30 seconds
- ✅ File size: < 20 MB
- ✅ Accessible URL

### Other
- ✅ Prompt: < 2500 characters
- ✅ cfg_scale: 0-1 range
- ✅ character_orientation: "video" or "image"

## 🔐 Security Checklist

- [ ] API key in .env (not .env.local)
- [ ] Never commit .env files
- [ ] CORS_ORIGIN set to your domain
- [ ] Webhook URLs use HTTPS
- [ ] File uploads limited to reasonable sizes
- [ ] Input validation enabled

## 🆘 Common Issues

| Issue | Solution |
|-------|----------|
| "Backend offline" | Start backend: `npm run dev` in /backend |
| "Invalid API key" | Check FREEPIK_API_KEY in .env |
| "Image too large" | Compress to < 10 MB |
| "Video too long" | Trim video to < 30 seconds |
| "Invalid URL" | Ensure URL is publicly accessible |
| "CORS error" | Check CORS_ORIGIN in .env |
| "Cannot read file" | Try different browser or clear cache |

## 📞 Help Resources

- **Freepik API Docs**: https://docs.freepik.com
- **Issue in backend?** Check `backend/src/index.js` logs
- **Issue in frontend?** Check browser console (F12)
- **File validation?** Check `file-utils.ts`
- **Form not submitting?** Check `MotionControlForm.tsx`

## 🎓 File Structure at a Glance

```
project/
├── backend/
│   ├── src/index.js (main server + endpoints)
│   ├── storage/ (videos stored here)
│   └── .env (configure API key)
│
├── frontend/
│   ├── src/
│   │   ├── app/page.tsx (main UI)
│   │   ├── components/
│   │   │   └── MotionControlForm.tsx (form)
│   │   └── lib/
│   │       ├── motion-control-api.ts (API)
│   │       └── file-utils.ts (files)
│   └── .env.local (configure backend URL)
│
└── Documentation/
    ├── MOTION_CONTROL_GUIDE.md (detailed)
    ├── API_EXAMPLES.md (requests)
    ├── IMPLEMENTATION_SUMMARY.md (overview)
    └── QUICK_REFERENCE.md (this file)
```

## 🚀 Next Level

### Customization
- Edit colors in `MotionControlForm.tsx` (tailwind classes)
- Adjust motion strength range (currently 0-10)
- Change polling interval (currently 5 seconds)
- Add custom prompts or presets

### Production
- Add authentication
- Implement rate limiting
- Add video analytics tracking
- Setup monitoring/alerts
- Use persistent database for assets
- Deploy to cloud platform

### Features
- Batch video generation
- Advanced motion presets
- Custom orientation guidance
- Real-time preview
- A/B testing different settings

---

**Remember**: When in doubt, check the console logs! 🔍
