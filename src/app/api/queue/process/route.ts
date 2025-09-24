import { NextRequest } from "next/server";
import { 
  getNextTasksToProcess, 
  markTaskAsProcessing, 
  markTaskAsCompleted, 
  markTaskAsFailed,
  getActiveProcessingCount,
  updateVideoStatus,
  saveVideo
} from "@/lib/supabase";
import { enhancePromptForKlingAI } from "@/lib/openai";

const MAX_CONCURRENT_TASKS = 3;
const ACCOUNT_ID = 'default';

export async function POST(req: NextRequest) {
  try {
    console.log("🔄 [QUEUE PROCESSOR] Starting queue processing");
    
    // Check how many tasks are currently processing
    const activeCount = await getActiveProcessingCount(ACCOUNT_ID);
    console.log("📊 [QUEUE PROCESSOR] Currently processing tasks:", activeCount);
    
    if (activeCount >= MAX_CONCURRENT_TASKS) {
      console.log("⏸️ [QUEUE PROCESSOR] Max concurrent tasks reached, skipping");
      return new Response(JSON.stringify({ 
        message: "Max concurrent tasks reached",
        activeCount,
        maxConcurrent: MAX_CONCURRENT_TASKS
      }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Calculate how many tasks we can start
    const availableSlots = MAX_CONCURRENT_TASKS - activeCount;
    console.log("🎯 [QUEUE PROCESSOR] Available slots:", availableSlots);
    
    // Get next tasks to process
    const tasksToProcess = await getNextTasksToProcess(ACCOUNT_ID, availableSlots);
    console.log("📋 [QUEUE PROCESSOR] Found tasks to process:", tasksToProcess.length);
    
    if (tasksToProcess.length === 0) {
      console.log("✅ [QUEUE PROCESSOR] No tasks in queue");
      return new Response(JSON.stringify({ 
        message: "No tasks in queue",
        activeCount,
        processedCount: 0
      }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Process each task
    const results = await Promise.allSettled(
      tasksToProcess.map(async (task) => {
        try {
          console.log("🚀 [QUEUE PROCESSOR] Processing task:", task.task_id);
          
          // Mark task as processing
          await markTaskAsProcessing(task.task_id);
          
          // Extract task data
          const taskData = task.task_data;
          const { frameId, sessionId, image, imageTail, prompt, negativePrompt, mode, duration, aspectRatio, videoIndex, totalVideos } = taskData;
          
          // Enhance the prompt using OpenAI
          console.log("🤖 [QUEUE PROCESSOR] Enhancing prompt:", prompt);
          const enhancedPromptResult = await enhancePromptForKlingAI(prompt, {
            fromImage: image,
            toImage: imageTail,
            duration: duration || 5,
            style: mode || "std"
          });
          
          const enhancedPrompt = enhancedPromptResult.enhancedPrompt;
          console.log("✅ [QUEUE PROCESSOR] Enhanced prompt:", enhancedPrompt);
          
          // Call KlingAI API directly
          const { getKlingBaseUrl, createKlingHeaders } = await import('@/lib/kling');
          
          const klingUrl = `${getKlingBaseUrl()}/v1/videos/image2video`;
          console.log("🌐 [QUEUE PROCESSOR] Calling KlingAI API at:", klingUrl);
          
          const klingResponse = await fetch(klingUrl, {
            method: "POST",
            headers: createKlingHeaders(),
            body: JSON.stringify({
              model_name: "kling-v2-1",
              image: image, // Already base64 string
              image_tail: imageTail, // Already base64 string
              prompt: enhancedPrompt,
              negative_prompt: 'no face swap, no different actor, no hairstyle change, no different clothes, no mask, no occlusion of face, no heavy motion blur',
              mode: "pro",
              duration: "5",
              external_task_id: task.task_id
            })
          });
          
          if (!klingResponse.ok) {
            const errorText = await klingResponse.text();
            throw new Error(`Kling API error: ${klingResponse.status} - ${errorText}`);
          }
          
          const klingResult = await klingResponse.json();
          console.log("🎬 [QUEUE PROCESSOR] KlingAI API response:", klingResult);
          
          if (klingResult.code !== 0) {
            throw new Error(`KlingAI API error: ${klingResult.message}`);
          }
          
          // Extract task information from the response
          const klingTaskId = klingResult.data?.task_id;
          const taskStatus = klingResult.data?.task_status;
          
          if (!klingTaskId) {
            throw new Error("No task_id returned from KlingAI API");
          }
          
          console.log("✅ [QUEUE PROCESSOR] Task created successfully:", {
            klingTaskId,
            taskStatus
          });
          
          // Save initial video record with the KlingAI task ID
          await saveVideo({
            taskId: klingTaskId,
            frameId,
            sessionId,
            status: taskStatus
          });
          
          // Mark task as completed in queue
          await markTaskAsCompleted(task.task_id);
          
          console.log("✅ [QUEUE PROCESSOR] Task completed successfully:", task.task_id);
          return { taskId: task.task_id, status: 'success', klingResult };
          
        } catch (error: any) {
          console.error("❌ [QUEUE PROCESSOR] Task failed:", task.task_id, error);
          
          // Mark task as failed in queue
          await markTaskAsFailed(task.task_id, error.message);
          
          // Update video status to failed
          await updateVideoStatus(task.task_id, 'failed', undefined, error.message);
          
          return { taskId: task.task_id, status: 'failed', error: error.message };
        }
      })
    );
    
    // Count successful and failed tasks
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.status === 'success').length;
    const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status === 'failed')).length;
    
    console.log("📊 [QUEUE PROCESSOR] Processing complete:", { successful, failed, total: results.length });
    
    return new Response(JSON.stringify({
      message: "Queue processing completed",
      activeCount: activeCount + successful,
      processedCount: results.length,
      successful,
      failed,
      results: results.map(r => r.status === 'fulfilled' ? r.value : { status: 'rejected', error: r.reason })
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error: any) {
    console.error("💥 [QUEUE PROCESSOR] Error processing queue:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Failed to process queue" 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    console.log("📊 [QUEUE PROCESSOR] Getting queue status");
    
    const activeCount = await getActiveProcessingCount(ACCOUNT_ID);
    
    return new Response(JSON.stringify({
      activeCount,
      maxConcurrent: MAX_CONCURRENT_TASKS,
      availableSlots: MAX_CONCURRENT_TASKS - activeCount
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error: any) {
    console.error("💥 [QUEUE PROCESSOR] Error getting queue status:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Failed to get queue status" 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
