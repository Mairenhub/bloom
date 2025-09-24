import { NextRequest } from "next/server";
import { getActiveProcessingCount, addTaskToQueue, saveVideo } from "@/lib/supabase";
import { getKlingBaseUrl, createKlingHeaders, stripDataUrlPrefix } from "@/lib/kling";
import { generateBatchPrompts, enhancePromptForKlingAI } from "@/lib/openai";

const MAX_CONCURRENT_TASKS = 3;

export async function POST(req: NextRequest) {
  try {
    console.log("🚀 [PROCESS OR QUEUE] Processing or queuing task");
    
    const body = await req.json();
    const { taskId, sessionId, frameId, priority, taskData, accountId } = body;
    
    if (!taskId || !taskData) {
      return new Response(JSON.stringify({ 
        error: "taskId and taskData are required" 
      }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Check current processing count (with fallback if table doesn't exist)
    let currentProcessing = 0;
    try {
      currentProcessing = await getActiveProcessingCount(accountId || 'default');
      console.log("📊 [PROCESS OR QUEUE] Current processing:", currentProcessing, "Max:", MAX_CONCURRENT_TASKS);
    } catch (error) {
      console.log("⚠️ [PROCESS OR QUEUE] Queue table not available, assuming no active processing");
      currentProcessing = 0;
    }

    if (currentProcessing < MAX_CONCURRENT_TASKS) {
      // Process immediately
      console.log("⚡ [PROCESS OR QUEUE] Processing immediately - spots available");
      
      try {
        // Extract task data
        const { prompt, videoIndex } = taskData;
      
        // Enhance the prompt using OpenAI
        console.log("🤖 [PROCESS OR QUEUE] Enhancing prompt:", prompt);
        const enhancedPromptResult = await enhancePromptForKlingAI(prompt, {
          fromImage: taskData.image,
          toImage: taskData.imageTail,
          duration: taskData.duration || 5,
          style: taskData.mode || "std"
        });
        
        const enhancedPrompt = enhancedPromptResult.enhancedPrompt;
        console.log("✅ [PROCESS OR QUEUE] Enhanced prompt:", enhancedPrompt);

        // Call KlingAI API directly
        const klingUrl = `${getKlingBaseUrl()}/v1/videos/image2video`;
        console.log("🌐 [PROCESS OR QUEUE] Calling KlingAI API at:", klingUrl);
        
        const klingResponse: Response = await fetch(klingUrl, {
          method: "POST",
          headers: createKlingHeaders(),
          body: JSON.stringify({
            model_name: "kling-v2-1",
            image: stripDataUrlPrefix(taskData.image),
            image_tail: stripDataUrlPrefix(taskData.imageTail),
            prompt: enhancedPrompt,
            negative_prompt: 'no face swap, no different actor, no hairstyle change, no different clothes, no mask, no occlusion of face, no heavy motion blur',
            mode: "pro",
            duration: "5",
            external_task_id: taskId
          })
        });

        if (!klingResponse.ok) {
          const errorData = await klingResponse.json();
          console.error("❌ [PROCESS OR QUEUE] KlingAI API error:", errorData);
          throw new Error(errorData.message || `KlingAI API error: ${klingResponse.status}`);
        }

        const klingResult: any = await klingResponse.json();
        console.log("✅ [PROCESS OR QUEUE] KlingAI response:", klingResult);

        // Check if the API returned an error code
        if (klingResult.code !== 0) {
          console.error("❌ [PROCESS OR QUEUE] KlingAI API returned error code:", klingResult.code, klingResult.message);
          throw new Error(klingResult.message || "KlingAI API returned error");
        }

        // Extract task information from the response
        const klingTaskId: string = klingResult.data?.task_id;
        const taskStatus: string = klingResult.data?.task_status;
        const externalTaskId: string = klingResult.data?.task_info?.external_task_id;

        if (!klingTaskId) {
          console.error("❌ [PROCESS OR QUEUE] No task_id in KlingAI response:", klingResult);
          throw new Error("No task_id returned from KlingAI API");
        }

        console.log("✅ [PROCESS OR QUEUE] Task created successfully:", {
          klingTaskId,
          taskStatus,
          externalTaskId
        });

        // Save video record to database for polling
        try {
          await saveVideo({
            taskId: klingTaskId,
            frameId: frameId,
            sessionId: sessionId,
            status: taskStatus
          });
          console.log("💾 [PROCESS OR QUEUE] Video record saved to database");
        } catch (dbError) {
          console.error("⚠️ [PROCESS OR QUEUE] Failed to save video record:", dbError);
          // Don't fail the entire request if database save fails
        }

        return new Response(JSON.stringify({
          success: true,
          processed: true,
          taskId: klingTaskId,
          status: taskStatus,
          externalTaskId: externalTaskId
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });

      } catch (error: any) {
        console.error("❌ [PROCESS OR QUEUE] Error processing immediately:", error);
        
        // If immediate processing fails, try to fall back to queue
        console.log("🔄 [PROCESS OR QUEUE] Falling back to queue due to error");
        try {
          const queueTask = await addTaskToQueue({
            taskId,
            sessionId,
            frameId,
            priority: priority || 0,
            taskData,
            accountId: accountId || 'default'
          });

          return new Response(JSON.stringify({
            success: true,
            processed: false,
            queued: true,
            taskId: queueTask.task_id,
            queueId: queueTask.id,
            status: queueTask.status
          }), {
            status: 200,
            headers: { "Content-Type": "application/json" }
          });
        } catch (queueError) {
          console.error("❌ [PROCESS OR QUEUE] Queue also failed, returning error:", queueError);
          throw error; // Re-throw the original error
        }
      }
    } else {
      // Add to queue
      console.log("📝 [PROCESS OR QUEUE] Adding to queue - no spots available");
      
      try {
        const queueTask = await addTaskToQueue({
          taskId,
          sessionId,
          frameId,
          priority: priority || 0,
          taskData,
          accountId: accountId || 'default'
        });

        return new Response(JSON.stringify({
          success: true,
          processed: false,
          queued: true,
          taskId: queueTask.task_id,
          queueId: queueTask.id,
          status: queueTask.status
        }), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        });
      } catch (queueError) {
        console.error("❌ [PROCESS OR QUEUE] Queue failed, processing immediately as fallback:", queueError);
        // Fall back to immediate processing if queue fails
        currentProcessing = 0; // Force immediate processing
      }
    }
    
  } catch (error: any) {
    console.error("💥 [PROCESS OR QUEUE] Error:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Failed to process or queue task" 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
