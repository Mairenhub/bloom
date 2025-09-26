# Cloudinary Setup for Video Combination

## Required Environment Variables

Add these environment variables to your Vercel project:

```bash
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

## How to Get Cloudinary Credentials

1. **Sign up for Cloudinary**: Go to [cloudinary.com](https://cloudinary.com) and create a free account
2. **Get your credentials**: 
   - Go to your Cloudinary Dashboard
   - Copy your **Cloud Name**, **API Key**, and **API Secret**
3. **Add to Vercel**:
   - Go to your Vercel project dashboard
   - Navigate to Settings → Environment Variables
   - Add the three variables above

## What This Does

- **Uses Cloudinary to combine videos** using their transformation API
- **Downloads the combined result** from Cloudinary
- **Uploads the combined video to your Supabase storage**
- **Returns the Supabase video URL** (not Cloudinary URL)
- **No FFmpeg required** - works perfectly on Vercel

## Features

- ✅ **Automatic video concatenation** using Cloudinary's `fl_splice` transformation
- ✅ **High-quality output** with automatic optimization
- ✅ **Stored in your Supabase bucket** - videos are saved to your own storage
- ✅ **Reliable on Vercel** - no system dependencies needed
- ✅ **Error handling** - clear error messages if configuration is missing
- ✅ **No permanent Cloudinary storage** - only used for processing

## Testing

Once you add the environment variables, the video combination will work automatically. You'll see logs like:

```
☁️ [COMBINE DEBUG] Using Cloudinary to combine videos...
🔗 [CLOUDINARY] Created concatenation URL: https://res.cloudinary.com/...
📥 [CLOUDINARY] Downloading combined video...
✅ [CLOUDINARY] Downloaded combined video: 1234567 bytes
📤 [COMBINE DEBUG] Uploading combined video to Supabase...
✅ [COMBINE DEBUG] Uploaded to Supabase: https://your-supabase-url...
```
