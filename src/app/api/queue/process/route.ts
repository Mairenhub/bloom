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
import Jimp from "jimp";

// Function to resize image to vertical phone dimensions (9:16 aspect ratio)
async function resizeImageToVerticalPhone(imageBuffer: Buffer): Promise<Buffer> {
  console.log(`🖼️ [RESIZE] Resizing image to 1080x1920 (9:16 aspect ratio)...`);
  
  try {
    // Load image with Jimp
    const image = await Jimp.read(imageBuffer);
    
    // Resize and crop to 1080x1920 (9:16 aspect ratio)
    // Using cover mode: resize to fill the area, then crop
    const resizedImage = image.cover(1080, 1920, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE);
    
    // Convert to JPEG with 90% quality
    const resizedBuffer = await resizedImage.quality(90).getBufferAsync(Jimp.MIME_JPEG);
    
    console.log(`✅ [RESIZE] Image resized successfully: ${resizedBuffer.length} bytes`);
    return resizedBuffer;
    
  } catch (error) {
    console.error(`❌ [RESIZE] Error resizing image:`, error);
    // Return original buffer if resize fails
    return imageBuffer;
  }
}

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
          const { frameId, sessionId, duration, aspectRatio, videoIndex, totalVideos, fromImageUrl, toImageUrl } = taskData;
          
          if (!fromImageUrl || !toImageUrl) {
            throw new Error("Image URLs not found in task");
          }
          
          // Download images from Supabase Storage and convert to base64
          console.log("📥 [QUEUE PROCESSOR] Downloading images from storage...");
          const fromImageResponse = await fetch(fromImageUrl);
          const toImageResponse = await fetch(toImageUrl);
          
          if (!fromImageResponse.ok || !toImageResponse.ok) {
            throw new Error("Failed to download images from storage");
          }
          
          const fromImageBuffer = await fromImageResponse.arrayBuffer();
          const toImageBuffer = await toImageResponse.arrayBuffer();
          
          // Resize images to standard vertical phone dimensions (9:16 aspect ratio)
          console.log("📐 [QUEUE PROCESSOR] Resizing images to 1080x1920 (9:16)...");
          const fromImageResized = await resizeImageToVerticalPhone(Buffer.from(fromImageBuffer));
          const toImageResized = await resizeImageToVerticalPhone(Buffer.from(toImageBuffer));
          
          const fromImage = fromImageResized.toString('base64');
          const toImage = toImageResized.toString('base64');
          
          // Enhance the prompt using OpenAI
          console.log("🤖 [QUEUE PROCESSOR] Enhancing prompt:", taskData.originalPrompt);
          const enhancedPromptResult = await enhancePromptForKlingAI(taskData.originalPrompt, {
            fromImage,
            toImage,
            duration: duration || 5,
            style: aspectRatio || "16:9"
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
              image: fromImage, // Already base64 string
              image_tail: toImage, // Already base64 string
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
          
          // Mark task as processing (not completed yet - we need to poll KlingAI)
          await markTaskAsProcessing(task.task_id);
          
          console.log("✅ [QUEUE PROCESSOR] Task submitted to KlingAI:", task.task_id, "KlingAI Task ID:", klingTaskId);
          return { taskId: task.task_id, status: 'submitted', klingTaskId };
          
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
