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
 * This creates a single video by concatenating multiple video URLs without uploading
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
  
  // For concatenation, we need to use the splice transformation
  // Format: fl_splice,so_0,eo_5/video1.mp4|video2.mp4|video3.mp4
  const videoSources = videoUrls.map(url => {
    // If it's already a Cloudinary URL, extract the public ID
    const cloudinaryMatch = url.match(/\/video\/upload\/(.+?)\/(.+)$/);
    if (cloudinaryMatch) {
      return cloudinaryMatch[2]; // Return the public ID
    }
    
    // If it's an external URL, we need to use the fetch transformation
    // Encode the URL for use in Cloudinary
    const encodedUrl = encodeURIComponent(url);
    return `fetch:${encodedUrl}`;
  }).join('|');
  
  const transformation = 'fl_splice,so_0,eo_5'; // Splice videos together
  const concatenatedUrl = `${baseUrl}/${transformation}/${videoSources}`;
  
  console.log('🔗 [CLOUDINARY] Created concatenation URL:', concatenatedUrl);
  return concatenatedUrl;
}

/**
 * Combine videos using Cloudinary and download the result
 * This creates a transformation URL, downloads the combined video, and returns the buffer
 */
export async function combineVideosWithCloudinary(videoUrls: string[]): Promise<Buffer> {
  console.log(`🔗 [CLOUDINARY] Creating concatenation URL for ${videoUrls.length} videos`);
  
  const concatenatedUrl = createVideoConcatenationUrl(videoUrls);
  
  console.log(`✅ [CLOUDINARY] Concatenation URL created: ${concatenatedUrl.substring(0, 100)}...`);
  
  // Download the combined video from Cloudinary
  console.log(`📥 [CLOUDINARY] Downloading combined video...`);
  const response = await fetch(concatenatedUrl);
  
  if (!response.ok) {
    throw new Error(`Failed to download combined video: ${response.statusText}`);
  }
  
  const arrayBuffer = await response.arrayBuffer();
  const videoBuffer = Buffer.from(arrayBuffer);
  
  console.log(`✅ [CLOUDINARY] Downloaded combined video: ${videoBuffer.length} bytes`);
  
  return videoBuffer;
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
