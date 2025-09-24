import { NextRequest } from "next/server";
import { addTaskToQueue } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    console.log("📝 [QUEUE ADD] Adding task to queue");
    
    const body = await req.json();
    const { taskId, sessionId, frameId, priority, taskData, accountId } = body;
    
    console.log("📝 [QUEUE ADD] Task details:", { 
      taskId, 
      sessionId, 
      frameId, 
      priority, 
      accountId,
      hasTaskData: !!taskData
    });
    
    if (!taskId || !taskData) {
      return new Response(JSON.stringify({ 
        error: "taskId and taskData are required" 
      }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Add task to queue
    let queueTask;
    try {
      queueTask = await addTaskToQueue({
        taskId,
        sessionId,
        frameId,
        priority: priority || 0,
        taskData,
        accountId: accountId || 'default'
      });
      
      console.log("✅ [QUEUE ADD] Task added to queue successfully:", queueTask);
    } catch (error: any) {
      console.error("❌ [QUEUE ADD] Error adding task to queue:", error);
      return new Response(JSON.stringify({ 
        error: `Failed to add task to queue: ${error.message}` 
      }), { 
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    return new Response(JSON.stringify({
      success: true,
      taskId: queueTask.task_id,
      queueId: queueTask.id,
      status: queueTask.status
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error: any) {
    console.error("💥 [QUEUE ADD] Error adding task to queue:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Failed to add task to queue" 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
