import { NextRequest } from "next/server";
import { getAllVideos, createVideoSession } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    console.log("📋 [VIDEOS API] Getting all videos");
    const videos = await getAllVideos();
    
    return new Response(JSON.stringify({ videos }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("💥 [VIDEOS API] Error getting videos:", error);
    return new Response(JSON.stringify({ error: "Failed to get videos" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, totalVideos } = body;
    
    console.log("🎬 [VIDEOS API] Creating video session:", { sessionId, totalVideos });
    
    if (!sessionId || !totalVideos) {
      return new Response(JSON.stringify({ error: "sessionId and totalVideos are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    const sessionId_result = await createVideoSession(sessionId, totalVideos);
    
    return new Response(JSON.stringify({ 
      success: true, 
      sessionId: sessionId_result 
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("💥 [VIDEOS API] Error creating session:", error);
    return new Response(JSON.stringify({ error: "Failed to create session" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
