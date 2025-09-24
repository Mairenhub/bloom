import { NextRequest } from "next/server";
import { uploadVideo } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    console.log("📥 [DOWNLOAD API] Starting video download and upload");
    
    const body = await req.json();
    const { klingUrl, taskId } = body;
    
    if (!klingUrl || !taskId) {
      return new Response(JSON.stringify({ 
        error: "klingUrl and taskId are required" 
      }), { status: 400 });
    }

    console.log("📥 [DOWNLOAD API] Downloading from KlingAI:", klingUrl);
    
    // Download video from KlingAI
    const response = await fetch(klingUrl);
    if (!response.ok) {
      throw new Error(`Failed to download video: ${response.statusText}`);
    }
    
    const videoBlob = await response.blob();
    const videoFile = new File([videoBlob], `${taskId}.mp4`, { type: 'video/mp4' });
    
    console.log("📤 [DOWNLOAD API] Uploading to Supabase Storage");
    
    // Upload to Supabase Storage
    const supabaseUrl = await uploadVideo(videoFile, taskId);
    
    console.log("✅ [DOWNLOAD API] Video processed successfully:", supabaseUrl);
    
    return new Response(JSON.stringify({
      success: true,
      videoUrl: supabaseUrl,
      taskId
    }), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("❌ [DOWNLOAD API] Error processing video:", error);
    return new Response(JSON.stringify({ 
      error: error?.message || "Failed to process video" 
    }), { status: 500 });
  }
}
