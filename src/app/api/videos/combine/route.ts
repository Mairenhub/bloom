import { NextRequest } from "next/server";
import { supabase, uploadVideo } from "@/lib/supabase";
import { combineVideosWithCloudinary } from "@/lib/cloudinary";

// Check if Cloudinary is configured
function checkCloudinaryConfig(): void {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary configuration missing. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET environment variables.');
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log("🎬 [COMBINE DEBUG] Starting video combination request");
    
    // Check Cloudinary configuration
    checkCloudinaryConfig();
    
    const body = await req.json();
    const { sessionId, videoUrls, duration, aspectRatio } = body;
    
    if (!sessionId || !videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
      return new Response(JSON.stringify({ 
        error: "sessionId and videoUrls array are required" 
      }), { status: 400 });
    }

    console.log("🎬 [COMBINE DEBUG] Combining videos with Cloudinary:", {
      sessionId,
      videoCount: videoUrls.length,
      videoUrls: videoUrls.map((url, i) => `video_${i}: ${url.substring(0, 50)}...`),
      duration,
      aspectRatio
    });

    const combinedVideoId = `combined-${sessionId}-${Date.now()}`;
    
    try {
      // Use Cloudinary to combine videos and download the result
      console.log("☁️ [COMBINE DEBUG] Using Cloudinary to combine videos...");
      const combinedVideoBuffer = await combineVideosWithCloudinary(videoUrls);
      
      console.log("✅ [COMBINE DEBUG] Cloudinary processing completed:", {
        combinedVideoSize: combinedVideoBuffer.length,
        originalVideoCount: videoUrls.length
      });
      
      // Create a File object for Supabase upload
      const combinedFile = new File([new Uint8Array(combinedVideoBuffer)], `${combinedVideoId}.mp4`, { type: 'video/mp4' });
      
      // Upload combined video to Supabase storage
      console.log("📤 [COMBINE DEBUG] Uploading combined video to Supabase...");
      const combinedVideoUrl = await uploadVideo(combinedFile, combinedVideoId);
      
      console.log("✅ [COMBINE DEBUG] Uploaded to Supabase:", combinedVideoUrl);
      
      // Save combined video to database
      await supabase
        .from('videos')
        .insert({
          task_id: combinedVideoId,
          session_id: sessionId,
          status: 'completed',
          video_url: combinedVideoUrl,
          is_combined: true,
          metadata: {
            original_video_count: videoUrls.length,
            duration: duration || 5,
            aspect_ratio: aspectRatio || '16:9',
            combined_at: new Date().toISOString(),
            individual_videos: videoUrls,
            cloudinary_processed: true,
            stored_in_supabase: true
          }
        });

      console.log("✅ [COMBINE DEBUG] Video combination completed:", {
        combinedVideoId,
        combinedVideoUrl: combinedVideoUrl.substring(0, 50) + "...",
        originalCount: videoUrls.length,
        storedInSupabase: true
      });

      return new Response(JSON.stringify({
        success: true,
        taskId: combinedVideoId,
        url: combinedVideoUrl,
        status: 'completed',
        message: `Successfully combined ${videoUrls.length} videos using Cloudinary and stored in Supabase`,
        individualVideos: videoUrls,
        cloudinaryProcessed: true,
        storedInSupabase: true
      }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      });

    } catch (combineError) {
      console.error("❌ [COMBINE DEBUG] Error during combination:", combineError);
      
      // Save failed combination to database
      await supabase
        .from('videos')
        .insert({
          task_id: combinedVideoId,
          session_id: sessionId,
          status: 'failed',
          error_message: combineError instanceof Error ? combineError.message : 'Unknown error',
          is_combined: true
        });

      throw combineError;
    }

  } catch (error: any) {
    console.error("❌ [COMBINE DEBUG] Error combining videos:", error);
    return new Response(JSON.stringify({ 
      error: error?.message || "Failed to combine videos" 
    }), { status: 500 });
  }
}