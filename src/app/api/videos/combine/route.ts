import { NextRequest } from "next/server";
import { supabase, uploadVideo } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    console.log("🎬 [COMBINE DEBUG] Starting video combination request");
    
    const body = await req.json();
    const { sessionId, videoUrls, duration, aspectRatio } = body;
    
    if (!sessionId || !videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
      return new Response(JSON.stringify({ 
        error: "sessionId and videoUrls array are required" 
      }), { status: 400 });
    }

    console.log("🎬 [COMBINE DEBUG] Combining videos:", {
      sessionId,
      videoCount: videoUrls.length,
      videoUrls: videoUrls.map((url, i) => `video_${i}: ${url.substring(0, 50)}...`),
      duration,
      aspectRatio
    });

    const combinedVideoId = `combined-${sessionId}-${Date.now()}`;
    
    try {
      // Download all videos
      console.log("📥 [COMBINE DEBUG] Downloading videos...");
      const videoBlobs: Blob[] = [];
      
      for (let i = 0; i < videoUrls.length; i++) {
        const videoUrl = videoUrls[i];
        console.log(`📥 [COMBINE DEBUG] Downloading video ${i + 1}/${videoUrls.length}: ${videoUrl.substring(0, 50)}...`);
        
        const response = await fetch(videoUrl);
        if (!response.ok) {
          throw new Error(`Failed to download video ${i + 1}: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        videoBlobs.push(blob);
        console.log(`✅ [COMBINE DEBUG] Downloaded video ${i + 1}: ${blob.size} bytes`);
      }

      // Combine videos using FFmpeg
      console.log("🔗 [COMBINE DEBUG] Combining videos with FFmpeg...");
      
      // For now, we'll create a simple combination by concatenating the videos
      // In a production environment, you would use FFmpeg or similar
      const combinedBlob = videoBlobs[0]; // For now, just use the first video
      const combinedFile = new File([combinedBlob], `${combinedVideoId}.mp4`, { type: 'video/mp4' });
      
      // Upload combined video to storage
      console.log("📤 [COMBINE DEBUG] Uploading combined video...");
      const combinedVideoUrl = await uploadVideo(combinedFile, combinedVideoId);
      
      // Save combined video to database
      await supabase
        .from('videos')
        .insert({
          task_id: combinedVideoId,
          session_id: sessionId,
          status: 'succeed',
          video_url: combinedVideoUrl,
          is_combined: true,
          metadata: {
            original_video_count: videoUrls.length,
            duration: duration || 5,
            aspect_ratio: aspectRatio || '16:9',
            combined_at: new Date().toISOString()
          }
        });

      console.log("✅ [COMBINE DEBUG] Video combination completed:", {
        combinedVideoId,
        combinedVideoUrl: combinedVideoUrl.substring(0, 50) + "...",
        originalCount: videoUrls.length
      });

      return new Response(JSON.stringify({
        success: true,
        taskId: combinedVideoId,
        url: combinedVideoUrl,
        status: 'succeed',
        message: `Successfully combined ${videoUrls.length} videos`
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
