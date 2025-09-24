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
import { enhancePromptForKlingAI, detectCharacterFromPrompt, generateConsistentPrompt } from "@/lib/openai";

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
          const { frameId, sessionId, image, imageTail, prompt, negativePrompt, mode, duration, aspectRatio, videoIndex, totalVideos, character } = taskData;
          
          // Detect character from prompt if this is the first video in the session
          let currentCharacter = character;
          if (!currentCharacter && videoIndex === 0) {
            console.log("🔍 [QUEUE PROCESSOR] Detecting character from first video prompt");
            currentCharacter = detectCharacterFromPrompt(prompt);
            console.log("✅ [QUEUE PROCESSOR] Detected character:", currentCharacter);
          } else if (!currentCharacter && videoIndex > 0) {
            // For subsequent videos, we need to get the character from the first video
            console.log("🔍 [QUEUE PROCESSOR] Getting character from first video in session");
            // TODO: Implement logic to get character from first video in session
            // For now, use a default character
            currentCharacter = { type: 'person', name: 'HERO-01', idCard: 'HERO-01: same person across all clips' };
          }
          
          // Generate consistent prompt with character continuity
          console.log("🎬 [QUEUE PROCESSOR] Generating consistent prompt for video", (videoIndex || 0) + 1);
          const enhancedPrompt = generateConsistentPrompt(prompt, currentCharacter, videoIndex || 0);
          
          console.log("✅ [QUEUE PROCESSOR] Generated consistent prompt:", enhancedPrompt);
          
          // Call Kling API to generate video with consistent character
          const klingResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/kling/image2video`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model_name: "kling-v1-6",
              image,
              image_tail: imageTail,
              prompt: enhancedPrompt,
              negative_prompt: currentCharacter.negativePrompt,
              mode: "pro",
              duration: "5",
              aspect_ratio: "16:9",
              external_task_id: task.task_id
            })
          });
          
          if (!klingResponse.ok) {
            const errorText = await klingResponse.text();
            throw new Error(`Kling API error: ${klingResponse.status} - ${errorText}`);
          }
          
          const klingResult = await klingResponse.json();
          console.log("🎬 [QUEUE PROCESSOR] Kling API response:", klingResult);
          
          if (klingResult.code !== 0) {
            throw new Error(`Kling API error: ${klingResult.message}`);
          }
          
          // Save initial video record
          await saveVideo({
            taskId: task.task_id,
            frameId,
            sessionId,
            status: 'submitted'
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
