import { NextRequest } from "next/server";
import { getVideo, saveVideo, updateVideoStatus } from "@/lib/supabase";

export async function GET(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    console.log("🔍 [VIDEO API] Getting video for task:", taskId);
    
    const video = await getVideo(taskId);
    
    if (!video) {
      return new Response(JSON.stringify({ error: "Video not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    return new Response(JSON.stringify({ video }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("💥 [VIDEO API] Error getting video:", error);
    return new Response(JSON.stringify({ error: "Failed to get video" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const body = await req.json();
    const { status, videoUrl, errorMessage } = body;
    
    console.log("🔄 [VIDEO API] Updating video:", { taskId, status, videoUrl, errorMessage });
    
    if (!status) {
      return new Response(JSON.stringify({ error: "status is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const changes = await updateVideoStatus(taskId, status, videoUrl, errorMessage);
    
    if (changes === 0) {
      return new Response(JSON.stringify({ error: "Video not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      changes 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("💥 [VIDEO API] Error updating video:", error);
    return new Response(JSON.stringify({ error: "Failed to update video" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ taskId: string }> }) {
  try {
    const { taskId } = await params;
    const body = await req.json();
    const { frameId, sessionId, status, videoUrl, errorMessage } = body;
    
    console.log("💾 [VIDEO API] Creating video:", { taskId, frameId, sessionId, status, videoUrl, errorMessage });
    
    if (!frameId || !status) {
      return new Response(JSON.stringify({ error: "frameId and status are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const videoId = await saveVideo({
      taskId,
      frameId,
      sessionId,
      status,
      videoUrl,
      errorMessage
    });
    
    return new Response(JSON.stringify({ 
      success: true, 
      videoId 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("💥 [VIDEO API] Error creating video:", error);
    return new Response(JSON.stringify({ error: "Failed to create video" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
