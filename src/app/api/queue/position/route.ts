import { NextRequest } from "next/server";
import { getQueuePositionAndWaitTime } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');
    const accountId = searchParams.get('accountId') || 'default';
    
    if (!taskId) {
      return new Response(JSON.stringify({ 
        error: "taskId is required" 
      }), { status: 400 });
    }
    
    console.log(`🔍 [QUEUE POSITION] Getting position for task: ${taskId}`);
    
    const queueInfo = await getQueuePositionAndWaitTime(taskId, accountId);
    
    return new Response(JSON.stringify({
      success: true,
      taskId,
      ...queueInfo
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error: any) {
    console.error("❌ [QUEUE POSITION] Error:", error);
    return new Response(JSON.stringify({ 
      error: error?.message || "Failed to get queue position" 
    }), { status: 500 });
  }
}
