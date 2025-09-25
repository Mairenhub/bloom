import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getKlingBaseUrl, createKlingHeaders } from "@/lib/kling";

export async function POST(request: NextRequest) {
  try {
    console.log("🔍 [VIDEO STATUS] Starting video status check");
    
    // Get all videos that are submitted but not completed
    const { data: videos, error } = await supabaseAdmin
      .from('videos')
      .select('*')
      .in('status', ['submitted', 'processing'])
      .is('video_url', null);
    
    if (error) {
      throw new Error(`Failed to fetch videos: ${error.message}`);
    }
    
    console.log(`📊 [VIDEO STATUS] Found ${videos.length} videos to check`);
    
    const results = await Promise.allSettled(
      videos.map(async (video) => {
        try {
          console.log(`🔍 [VIDEO STATUS] Checking video: ${video.task_id}`);
          
          // Check KlingAI status using the correct endpoint and authentication
          const klingUrl = `${getKlingBaseUrl()}/v1/videos/image2video/${video.task_id}`;
          console.log(`🔍 [VIDEO STATUS] Checking KlingAI URL: ${klingUrl}`);
          
          const klingResponse = await fetch(klingUrl, {
            method: 'GET',
            headers: createKlingHeaders()
          });
          
          if (!klingResponse.ok) {
            throw new Error(`KlingAI API error: ${klingResponse.statusText}`);
          }
          
          const klingData = await klingResponse.json();
          console.log(`📊 [VIDEO STATUS] KlingAI response for ${video.task_id}:`, klingData);
          
          if (klingData.code === 0 && klingData.data) {
            const { task_status, task_result, task_info } = klingData.data;
            
            if (task_status === 'succeed' && task_result?.videos?.[0]?.url) {
              const video_url = task_result.videos[0].url;
              const external_task_id = task_info?.external_task_id;
              console.log(`✅ [VIDEO STATUS] Video completed: ${video.task_id}`);
              
              // Update video with URL and mark as completed
              const { error: updateError } = await supabaseAdmin
                .from('videos')
                .update({
                  status: 'completed',
                  video_url: video_url,
                  updated_at: new Date().toISOString()
                })
                .eq('task_id', video.task_id);
              
              if (updateError) {
                throw new Error(`Failed to update video: ${updateError.message}`);
              }
              
              // Mark corresponding queue task as completed using external_task_id
              if (external_task_id) {
                const { error: queueError } = await supabaseAdmin
                  .from('video_queue')
                  .update({
                    status: 'completed',
                    completed_at: new Date().toISOString()
                  })
                  .eq('task_id', external_task_id);
                
                if (queueError) {
                  console.warn(`⚠️ [VIDEO STATUS] Failed to update queue for ${external_task_id}:`, queueError.message);
                } else {
                  console.log(`✅ [VIDEO STATUS] Queue task completed: ${external_task_id}`);
                }
              } else {
                console.warn(`⚠️ [VIDEO STATUS] No external_task_id found for video ${video.task_id}`);
              }
              
              return { taskId: video.task_id, status: 'completed', videoUrl: video_url };
              
            } else if (task_status === 'failed') {
              const external_task_id = task_info?.external_task_id;
              console.log(`❌ [VIDEO STATUS] Video failed: ${video.task_id}`);
              
              // Update video as failed
              const { error: updateError } = await supabaseAdmin
                .from('videos')
                .update({
                  status: 'failed',
                  error_message: 'Video generation failed at KlingAI',
                  updated_at: new Date().toISOString()
                })
                .eq('task_id', video.task_id);
              
              if (updateError) {
                throw new Error(`Failed to update video: ${updateError.message}`);
              }
              
              // Mark corresponding queue task as failed using external_task_id
              if (external_task_id) {
                const { error: queueError } = await supabaseAdmin
                  .from('video_queue')
                  .update({
                    status: 'failed',
                    error_message: 'Video generation failed at KlingAI',
                    completed_at: new Date().toISOString()
                  })
                  .eq('task_id', external_task_id);
                
                if (queueError) {
                  console.warn(`⚠️ [VIDEO STATUS] Failed to update queue for ${external_task_id}:`, queueError.message);
                } else {
                  console.log(`✅ [VIDEO STATUS] Queue task failed: ${external_task_id}`);
                }
              } else {
                console.warn(`⚠️ [VIDEO STATUS] No external_task_id found for failed video ${video.task_id}`);
              }
              
              return { taskId: video.task_id, status: 'failed' };
              
            } else if (task_status === 'submitted' || task_status === 'processing') {
              console.log(`⏳ [VIDEO STATUS] Video still processing: ${video.task_id} (${task_status})`);
              return { taskId: video.task_id, status: 'processing' };
            } else {
              console.log(`❓ [VIDEO STATUS] Unknown status for video ${video.task_id}: ${task_status}`);
              return { taskId: video.task_id, status: 'unknown', error: `Unknown status: ${task_status}` };
            }
          } else {
            throw new Error(`Invalid KlingAI response: ${JSON.stringify(klingData)}`);
          }
          
        } catch (error: any) {
          console.error(`❌ [VIDEO STATUS] Error checking video ${video.task_id}:`, error);
          return { taskId: video.task_id, status: 'error', error: error.message };
        }
      })
    );
    
    const completed = results.filter(r => r.status === 'fulfilled' && r.value.status === 'completed').length;
    const failed = results.filter(r => r.status === 'fulfilled' && r.value.status === 'failed').length;
    const processing = results.filter(r => r.status === 'fulfilled' && r.value.status === 'processing').length;
    const errors = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status === 'error')).length;
    
    console.log(`📊 [VIDEO STATUS] Check complete: ${completed} completed, ${failed} failed, ${processing} processing, ${errors} errors`);
    
    return new Response(JSON.stringify({
      success: true,
      completed,
      failed,
      processing,
      errors,
      total: videos.length
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error: unknown) {
    console.error("💥 [VIDEO STATUS] Error checking video status:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Failed to check video status"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
