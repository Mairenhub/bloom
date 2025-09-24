import { NextRequest } from "next/server";
import { getQueueStatus, getQueuePosition } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {

    
    const { searchParams } = new URL(req.url);
    const taskId = searchParams.get('taskId');
    const accountId = searchParams.get('accountId') || 'default';
    
    // Get overall queue status
    const queueStatus = await getQueueStatus(accountId);
    
    // If taskId is provided, get position for that specific task
    let position = null;
    if (taskId) {
      position = await getQueuePosition(taskId, accountId);
    }
    
    // Format the response
    const statusMap = queueStatus.reduce((acc: any, item: any) => {
      acc[item.status] = item.count;
      return acc;
    }, {});
    
    const response = {
      accountId,
      status: {
        queued: statusMap.queued || 0,
        processing: statusMap.processing || 0,
        completed: statusMap.completed || 0,
        failed: statusMap.failed || 0
      },
      total: Object.values(statusMap).reduce((sum: number, count: any) => sum + count, 0)
    };
    
    if (position !== null) {
      (response as any).position = position;
    }
    
    
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error: any) {
    console.error("💥 [QUEUE STATUS] Error getting queue status:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Failed to get queue status" 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
