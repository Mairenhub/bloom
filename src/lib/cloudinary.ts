import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export { cloudinary };

/**
 * Upload a video to Cloudinary
 */
export async function uploadVideoToCloudinary(videoBuffer: Buffer, publicId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        resource_type: 'video',
        public_id: publicId,
        format: 'mp4',
        quality: 'auto',
        eager: [
          { format: 'mp4', quality: 'auto' }
        ]
      },
      (error, result) => {
        if (error) {
          console.error('❌ [CLOUDINARY] Upload error:', error);
          reject(error);
        } else if (result) {
          console.log('✅ [CLOUDINARY] Video uploaded:', result.secure_url);
          resolve(result.secure_url);
        } else {
          reject(new Error('No result from Cloudinary upload'));
        }
      }
    ).end(videoBuffer);
  });
}

/**
 * Create a video concatenation URL using Cloudinary
 * This creates a single video by concatenating multiple video URLs
 */
export function createVideoConcatenationUrl(videoUrls: string[]): string {
  if (videoUrls.length === 0) {
    throw new Error('No video URLs provided');
  }

  if (videoUrls.length === 1) {
    return videoUrls[0];
  }

  // Create Cloudinary transformation URL for video concatenation
  const baseUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload`;
  
  // Extract public IDs from Cloudinary URLs
  const publicIds = videoUrls.map(url => {
    const cloudinaryMatch = url.match(/\/video\/upload\/(.+?)\/(.+)$/);
    if (cloudinaryMatch) {
      return cloudinaryMatch[2]; // Return the public ID
    }
    throw new Error(`Expected Cloudinary URL, got: ${url}`);
  });
  
  // For multiple videos, we need to chain them properly
  // Based on Cloudinary docs: fl_splice,l_video:video1/fl_layer_apply/fl_splice,l_video:video2/fl_layer_apply/base_video
  // We want videos in original order, so first video is base, others are concatenated after it
  const baseVideo = publicIds[0]; // First video is the base
  const layersToConcatenate = publicIds.slice(1); // Rest are concatenated after
  
  // Build the transformation chain - each layer needs its own fl_splice and fl_layer_apply
  const transformations = layersToConcatenate.map(publicId => {
    const cleanPublicId = publicId.replace(/\//g, ':');
    return `fl_splice,l_video:${cleanPublicId}/fl_layer_apply`;
  }).join('/');
  
  const cleanBaseVideo = baseVideo.replace(/\//g, ':');
  const concatenatedUrl = `${baseUrl}/${transformations}/${cleanBaseVideo}`;
  
  console.log('🔗 [CLOUDINARY] Created concatenation URL:', concatenatedUrl);
  console.log('🔗 [CLOUDINARY] Debug info:', {
    baseUrl,
    publicIds,
    baseVideo,
    layersToConcatenate,
    transformations,
    cleanBaseVideo
  });
  return concatenatedUrl;
}

/**
 * Combine videos using Cloudinary and download the result
 * This downloads videos first, uploads them to Cloudinary, then combines them
 */
export async function combineVideosWithCloudinary(videoUrls: string[]): Promise<Buffer> {
  console.log(`🔗 [CLOUDINARY] Processing ${videoUrls.length} videos for combination`);
  
  if (videoUrls.length === 1) {
    // If only one video, just download it
    console.log(`📥 [CLOUDINARY] Single video, downloading directly...`);
    const response = await fetch(videoUrls[0]);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }
  
  // Download all videos first
  console.log(`📥 [CLOUDINARY] Downloading ${videoUrls.length} videos...`);
  const videoBuffers: Buffer[] = [];
  
  for (let i = 0; i < videoUrls.length; i++) {
    const videoUrl = videoUrls[i];
    console.log(`📥 [CLOUDINARY] Downloading video ${i + 1}/${videoUrls.length}...`);
    
    const response = await fetch(videoUrl);
    if (!response.ok) {
      throw new Error(`Failed to download video ${i + 1}: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    videoBuffers.push(buffer);
    console.log(`✅ [CLOUDINARY] Downloaded video ${i + 1}: ${buffer.length} bytes`);
  }
  
  // Upload videos to Cloudinary with temporary IDs
  console.log(`☁️ [CLOUDINARY] Uploading videos to Cloudinary...`);
  const cloudinaryUrls: string[] = [];
  
  for (let i = 0; i < videoBuffers.length; i++) {
    const tempId = `temp-${Date.now()}-${i}`;
    const url = await uploadVideoToCloudinary(videoBuffers[i], tempId);
    cloudinaryUrls.push(url);
    console.log(`✅ [CLOUDINARY] Uploaded video ${i + 1}: ${tempId}`);
  }
  
  // Try using Cloudinary SDK for concatenation instead of manual URL building
  console.log(`🔗 [CLOUDINARY] Using Cloudinary SDK for concatenation...`);
  
  try {
    // Extract public IDs from Cloudinary URLs
    const publicIds = cloudinaryUrls.map(url => {
      const match = url.match(/\/video\/upload\/(.+?)\/(.+)$/);
      return match ? match[2] : url;
    });
    
    console.log(`🔗 [CLOUDINARY] Public IDs:`, publicIds);
    
    // Use Cloudinary SDK to create the transformation URL
    // For multiple videos, we need to chain transformations
    // We want videos in original order, so first video is base, others are concatenated after it
    const baseVideo = publicIds[0]; // First video is the base
    const layersToConcatenate = publicIds.slice(1); // Rest are concatenated after
    
    // Build transformation chain manually using the SDK
    let transformationString = '';
    for (const publicId of layersToConcatenate) {
      transformationString += `fl_splice,l_video:${publicId}/fl_layer_apply/`;
    }
    
    const concatenatedUrl = cloudinary.url(`${transformationString}${baseVideo}`, {
      resource_type: 'video'
    });
    
    console.log(`🔗 [CLOUDINARY] SDK generated URL:`, concatenatedUrl);
    
    // Download the combined video
    console.log(`📥 [CLOUDINARY] Downloading combined video...`);
    const response = await fetch(concatenatedUrl);
    
    console.log(`📊 [CLOUDINARY] Response status:`, response.status);
    console.log(`📊 [CLOUDINARY] Response headers:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [CLOUDINARY] Download failed:`, errorText);
      console.error(`❌ [CLOUDINARY] Full URL that failed:`, concatenatedUrl);
      throw new Error(`Failed to download combined video: ${response.status} - ${errorText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const videoBuffer = Buffer.from(arrayBuffer);
    
    console.log(`✅ [CLOUDINARY] Downloaded combined video: ${videoBuffer.length} bytes`);
    
    return videoBuffer;
    
  } catch (sdkError) {
    console.error(`❌ [CLOUDINARY] SDK approach failed, trying manual URL:`, sdkError);
    
    // Fallback to manual URL approach
    const concatenatedUrl = createVideoConcatenationUrl(cloudinaryUrls);
    
    console.log(`📥 [CLOUDINARY] Downloading combined video (manual URL)...`);
    console.log(`🔗 [CLOUDINARY] Full concatenation URL:`, concatenatedUrl);
    const response = await fetch(concatenatedUrl);
    
    console.log(`📊 [CLOUDINARY] Response status:`, response.status);
    console.log(`📊 [CLOUDINARY] Response headers:`, Object.fromEntries(response.headers.entries()));
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [CLOUDINARY] Download failed:`, errorText);
      console.error(`❌ [CLOUDINARY] Full URL that failed:`, concatenatedUrl);
      throw new Error(`Failed to download combined video: ${response.status} - ${errorText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const videoBuffer = Buffer.from(arrayBuffer);
    
    console.log(`✅ [CLOUDINARY] Downloaded combined video: ${videoBuffer.length} bytes`);
    
    return videoBuffer;
  }
}

/**
 * Upload multiple videos and create a concatenated version
 * Use this if you want to store videos on Cloudinary
 */
export async function uploadAndConcatenateVideos(
  videoBuffers: Buffer[], 
  sessionId: string
): Promise<{ individualUrls: string[], concatenatedUrl: string }> {
  console.log(`🎬 [CLOUDINARY] Uploading ${videoBuffers.length} videos for concatenation`);
  
  // Upload each video individually
  const individualUrls: string[] = [];
  
  for (let i = 0; i < videoBuffers.length; i++) {
    const publicId = `${sessionId}-video-${i}`;
    const url = await uploadVideoToCloudinary(videoBuffers[i], publicId);
    individualUrls.push(url);
    console.log(`✅ [CLOUDINARY] Uploaded video ${i + 1}/${videoBuffers.length}: ${publicId}`);
  }
  
  // Create concatenated URL
  const concatenatedUrl = createVideoConcatenationUrl(individualUrls);
  
  return {
    individualUrls,
    concatenatedUrl
  };
}
