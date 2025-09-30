import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function POST(req: NextRequest) {
  try {
    const { sessionId } = await req.json();
    
    if (!sessionId) {
      return new Response(JSON.stringify({ 
        error: "sessionId is required" 
      }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log(`🔄 [RETRY FAILED] Retrying failed tasks for session: ${sessionId}`);

    // Get all failed tasks for this session
    const { data: failedTasks, error: fetchError } = await supabaseAdmin
      .from('video_queue')
      .select('*')
      .eq('session_id', sessionId)
      .eq('status', 'failed')
      .lt('retry_count', 3); // Only retry if under retry limit

    if (fetchError) {
      console.error("❌ [RETRY FAILED] Error fetching failed tasks:", fetchError);
      throw fetchError;
    }

    if (!failedTasks || failedTasks.length === 0) {
      console.log("ℹ️ [RETRY FAILED] No failed tasks found for session:", sessionId);
      return new Response(JSON.stringify({
        success: true,
        message: "No failed tasks to retry",
        retried: 0
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log(`🔄 [RETRY FAILED] Found ${failedTasks.length} failed tasks to retry`);

    // Reset failed tasks to queued status
    const taskIds = failedTasks.map(task => task.task_id);
    
    const { error: updateError } = await supabaseAdmin
      .from('video_queue')
      .update({
        status: 'queued',
        error_message: null,
        started_at: null,
        completed_at: null
      })
      .in('task_id', taskIds);

    if (updateError) {
      console.error("❌ [RETRY FAILED] Error updating failed tasks:", updateError);
      throw updateError;
    }

    // Also reset corresponding video records
    const { error: videoUpdateError } = await supabaseAdmin
      .from('videos')
      .update({
        status: 'submitted',
        error_message: null,
        updated_at: new Date().toISOString()
      })
      .in('task_id', taskIds);

    if (videoUpdateError) {
      console.warn("⚠️ [RETRY FAILED] Error updating video records:", videoUpdateError);
      // Don't fail the entire operation if video update fails
    }

    console.log(`✅ [RETRY FAILED] Successfully queued ${failedTasks.length} tasks for retry`);

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully queued ${failedTasks.length} tasks for retry`,
      retried: failedTasks.length,
      taskIds
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("💥 [RETRY FAILED] Error retrying failed tasks:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Failed to retry failed tasks" 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
