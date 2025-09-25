import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseKey)

// Server-side client with service role key for admin operations
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

// Storage operations for videos
export async function uploadVideo(file: File, taskId: string): Promise<string> {
  console.log("📤 [SUPABASE DEBUG] Uploading video:", taskId);
  
  const { data, error } = await supabase.storage
    .from('videos')
    .upload(`${taskId}.mp4`, file, {
      cacheControl: '3600',
      upsert: true
    });
  
  if (error) {
    console.error("❌ [SUPABASE DEBUG] Error uploading video:", error);
    throw error;
  }
  
  // Get public URL
  const { data: urlData } = supabase.storage
    .from('videos')
    .getPublicUrl(data.path);
  
  console.log("✅ [SUPABASE DEBUG] Video uploaded:", urlData.publicUrl);
  return urlData.publicUrl;
}

export async function downloadVideo(taskId: string): Promise<string> {
  console.log("📥 [SUPABASE DEBUG] Getting video URL:", taskId);
  
  const { data } = supabase.storage
    .from('videos')
    .getPublicUrl(`${taskId}.mp4`);
  
  return data.publicUrl;
}

// Video operations
export async function saveVideo(video: {
  taskId: string;
  frameId?: string;
  sessionId?: string;
  status: string;
  videoUrl?: string;
  errorMessage?: string;
  isCombined?: boolean;
}) {
  console.log("💾 [SUPABASE DEBUG] Saving video:", video);
  
  const { data, error } = await supabase
    .from('videos')
    .upsert({
      task_id: video.taskId,
      frame_id: video.frameId || null,
      session_id: video.sessionId || null,
      status: video.status,
      video_url: video.videoUrl || null,
      error_message: video.errorMessage || null,
      is_combined: video.isCombined || false,
      updated_at: new Date().toISOString()
    })
    .select()
    .single();
  
  if (error) {
    console.error("❌ [SUPABASE DEBUG] Error saving video:", error);
    throw error;
  }
  
  console.log("✅ [SUPABASE DEBUG] Video saved:", data);
  return data;
}

export async function getVideo(taskId: string) {
  console.log("🔍 [SUPABASE DEBUG] Getting video for task:", taskId);
  
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('task_id', taskId)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error("❌ [SUPABASE DEBUG] Error getting video:", error);
    throw error;
  }
  
  console.log("📄 [SUPABASE DEBUG] Video found:", data);
  return data;
}

export async function getAllVideos() {
  console.log("📋 [SUPABASE DEBUG] Getting all videos");
  
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error("❌ [SUPABASE DEBUG] Error getting videos:", error);
    throw error;
  }
  
  console.log("📄 [SUPABASE DEBUG] Found videos:", data?.length || 0);
  return data || [];
}

export async function getVideosBySession(sessionId: string) {
  console.log("🔍 [SUPABASE DEBUG] Getting videos for session:", sessionId);
  
  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true });
  
  if (error) {
    console.error("❌ [SUPABASE DEBUG] Error getting videos by session:", error);
    throw error;
  }
  
  console.log("📄 [SUPABASE DEBUG] Found videos for session:", data?.length || 0);
  return data || [];
}

export async function updateVideoStatus(taskId: string, status: string, videoUrl?: string, errorMessage?: string) {
  console.log("🔄 [SUPABASE DEBUG] Updating video status:", { taskId, status, videoUrl, errorMessage });
  
  const { data, error } = await supabase
    .from('videos')
    .update({
      status,
      video_url: videoUrl || null,
      error_message: errorMessage || null,
      updated_at: new Date().toISOString()
    })
    .eq('task_id', taskId)
    .select();
  
  if (error) {
    console.error("❌ [SUPABASE DEBUG] Error updating video:", error);
    throw error;
  }
  
  console.log("✅ [SUPABASE DEBUG] Video updated:", data);
  return data;
}

// Session operations
export async function createVideoSession(sessionId: string, totalVideos: number) {
  console.log("🎬 [SUPABASE DEBUG] Creating video session:", { sessionId, totalVideos });
  
  const { data, error } = await supabase
    .from('video_sessions')
    .upsert({
      session_id: sessionId,
      total_videos: totalVideos,
      completed_videos: 0
    })
    .select()
    .single();
  
  if (error) {
    console.error("❌ [SUPABASE DEBUG] Error creating session:", error);
    throw error;
  }
  
  console.log("✅ [SUPABASE DEBUG] Session created:", data);
  return data;
}

export async function getVideoSession(sessionId: string) {
  console.log("🔍 [SUPABASE DEBUG] Getting video session:", sessionId);
  
  const { data, error } = await supabase
    .from('video_sessions')
    .select('*')
    .eq('session_id', sessionId)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error("❌ [SUPABASE DEBUG] Error getting session:", error);
    throw error;
  }
  
  console.log("📄 [SUPABASE DEBUG] Session found:", data);
  return data;
}

export async function updateSessionProgress(sessionId: string) {
  console.log("📊 [SUPABASE DEBUG] Updating session progress:", sessionId);
  
  // Count completed videos for this session
  const { count, error: countError } = await supabase
    .from('videos')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .eq('status', 'succeed');
  
  if (countError) {
    console.error("❌ [SUPABASE DEBUG] Error counting videos:", countError);
    throw countError;
  }
  
  // Update session
  const { data, error } = await supabase
    .from('video_sessions')
    .update({
      completed_videos: count || 0,
      updated_at: new Date().toISOString()
    })
    .eq('session_id', sessionId)
    .select();
  
  if (error) {
    console.error("❌ [SUPABASE DEBUG] Error updating session:", error);
    throw error;
  }
  
  console.log("✅ [SUPABASE DEBUG] Session progress updated:", count);
  return data;
}

// Queue operations
export type QueueTask = {
  taskId: string;
  sessionId?: string;
  frameId?: string;
  priority?: number;
  taskData: any;
  accountId?: string;
};

export async function addTaskToQueue(task: QueueTask) {
  console.log("📝 [SUPABASE DEBUG] Adding task to queue:", task);
  
  const { data, error } = await supabase
    .from('video_queue')
    .insert({
      task_id: task.taskId,
      session_id: task.sessionId || null,
      frame_id: task.frameId || null,
      priority: task.priority || 0,
      task_data: task.taskData,
      account_id: task.accountId || 'default',
      status: 'queued'
    })
    .select()
    .single();
  
  if (error) {
    console.error("❌ [SUPABASE DEBUG] Error adding task to queue:", error);
    throw error;
  }
  
  console.log("✅ [SUPABASE DEBUG] Task added to queue:", data);
  return data;
}

export async function getNextTasksToProcess(accountId: string = 'default', limit: number = 3) {
  console.log("🔍 [SUPABASE DEBUG] Getting next tasks to process:", { accountId, limit });
  
  // Get tasks that are queued and haven't exceeded retry limit
  const { data, error } = await supabase
    .from('video_queue')
    .select('*')
    .eq('account_id', accountId)
    .eq('status', 'queued')
    .lt('retry_count', 3) // max_retries is 3 by default
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);
  
  if (error) {
    console.error("❌ [SUPABASE DEBUG] Error getting next tasks:", error);
    throw error;
  }
  
  console.log("📄 [SUPABASE DEBUG] Found tasks to process:", data?.length || 0);
  return data || [];
}

export async function markTaskAsProcessing(taskId: string) {
  console.log("🔄 [SUPABASE DEBUG] Marking task as processing:", taskId);
  
  const { data, error } = await supabase
    .from('video_queue')
    .update({
      status: 'processing',
      started_at: new Date().toISOString()
    })
    .eq('task_id', taskId)
    .select()
    .single();
  
  if (error) {
    console.error("❌ [SUPABASE DEBUG] Error marking task as processing:", error);
    throw error;
  }
  
  console.log("✅ [SUPABASE DEBUG] Task marked as processing:", data);
  return data;
}

export async function markTaskAsCompleted(taskId: string) {
  console.log("✅ [SUPABASE DEBUG] Marking task as completed:", taskId);
  
  const { data, error } = await supabase
    .from('video_queue')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('task_id', taskId)
    .select()
    .single();
  
  if (error) {
    console.error("❌ [SUPABASE DEBUG] Error marking task as completed:", error);
    throw error;
  }
  
  console.log("✅ [SUPABASE DEBUG] Task marked as completed:", data);
  return data;
}

export async function markTaskAsFailed(taskId: string, errorMessage: string) {
  console.log("❌ [SUPABASE DEBUG] Marking task as failed:", taskId, errorMessage);
  
  // First get the current retry count
  const { data: currentTask, error: fetchError } = await supabase
    .from('video_queue')
    .select('retry_count')
    .eq('task_id', taskId)
    .single();
  
  if (fetchError) {
    console.error("❌ [SUPABASE DEBUG] Error fetching task:", fetchError);
    throw fetchError;
  }
  
  const { data, error } = await supabase
    .from('video_queue')
    .update({
      status: 'failed',
      error_message: errorMessage,
      completed_at: new Date().toISOString(),
      retry_count: (currentTask.retry_count || 0) + 1
    })
    .eq('task_id', taskId)
    .select()
    .single();
  
  if (error) {
    console.error("❌ [SUPABASE DEBUG] Error marking task as failed:", error);
    throw error;
  }
  
  console.log("✅ [SUPABASE DEBUG] Task marked as failed:", data);
  return data;
}

export async function getQueueStatus(accountId: string = 'default') {
  console.log("📊 [SUPABASE DEBUG] Getting queue status:", accountId);
  
  // Get all queue items for the account
  const { data, error } = await supabase
    .from('video_queue')
    .select('status')
    .eq('account_id', accountId)
    .in('status', ['queued', 'processing', 'completed', 'failed']);
  
  if (error) {
    console.error("❌ [SUPABASE DEBUG] Error getting queue status:", error);
    throw error;
  }
  
  // Count statuses manually
  const statusCounts = {
    queued: 0,
    processing: 0,
    completed: 0,
    failed: 0
  };
  
  data?.forEach(item => {
    if (item.status in statusCounts) {
      statusCounts[item.status as keyof typeof statusCounts]++;
    }
  });
  
  // Convert to array format for compatibility
  const result = Object.entries(statusCounts).map(([status, count]) => ({
    status,
    count
  }));
  
  console.log("📄 [SUPABASE DEBUG] Queue status:", result);
  return result;
}

export async function getQueuePosition(taskId: string, accountId: string = 'default') {
  console.log("🔍 [SUPABASE DEBUG] Getting queue position for task:", taskId);
  
  // Get the task's priority and creation time
  const { data: task, error: taskError } = await supabase
    .from('video_queue')
    .select('priority, created_at')
    .eq('task_id', taskId)
    .eq('account_id', accountId)
    .single();
  
  if (taskError) {
    console.error("❌ [SUPABASE DEBUG] Error getting task:", taskError);
    throw taskError;
  }
  
  // Count tasks ahead in queue with higher priority or same priority but earlier creation
  const { count, error: countError } = await supabase
    .from('video_queue')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .eq('status', 'queued')
    .or(`priority.gt.${task.priority},and(priority.eq.${task.priority},created_at.lt.${task.created_at})`);
  
  if (countError) {
    console.error("❌ [SUPABASE DEBUG] Error counting queue position:", countError);
    throw countError;
  }
  
  console.log("📄 [SUPABASE DEBUG] Queue position:", count);
  return count || 0;
}

export async function getActiveProcessingCount(accountId: string = 'default') {
  console.log("🔍 [SUPABASE DEBUG] Getting active processing count:", accountId);
  
  const { count, error } = await supabase
    .from('video_queue')
    .select('*', { count: 'exact', head: true })
    .eq('account_id', accountId)
    .eq('status', 'processing');
  
  if (error) {
    console.error("❌ [SUPABASE DEBUG] Error getting active processing count:", error);
    throw error;
  }
  
  console.log("📄 [SUPABASE DEBUG] Active processing count:", count);
  return count || 0;
}

// Code management functions
export async function validateCode(code: string) {
  console.log("🔍 [SUPABASE DEBUG] Validating code:", code);
  
  const { data, error } = await supabase
    .from('codes')
    .select('*')
    .eq('code', code)
    .eq('is_redeemed', false)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
    console.error("❌ [SUPABASE DEBUG] Error validating code:", error);
    throw error;
  }
  
  if (!data) {
    console.log("❌ [SUPABASE DEBUG] Code not found or already redeemed");
    return null;
  }
  
  // Check if code is expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    console.log("❌ [SUPABASE DEBUG] Code has expired");
    return null;
  }
  
  console.log("✅ [SUPABASE DEBUG] Code is valid:", data);
  return data;
}

export async function redeemCode(code: string, redeemedBy: string) {
  console.log("🔍 [SUPABASE DEBUG] Redeeming code:", code, "by:", redeemedBy);
  
  const { data, error } = await supabase
    .from('codes')
    .update({
      is_redeemed: true,
      redeemed_at: new Date().toISOString(),
      redeemed_by: redeemedBy
    })
    .eq('code', code)
    .eq('is_redeemed', false)
    .select()
    .single();
  
  if (error) {
    console.error("❌ [SUPABASE DEBUG] Error redeeming code:", error);
    throw error;
  }
  
  if (!data) {
    throw new Error("Code not found or already redeemed");
  }
  
  console.log("✅ [SUPABASE DEBUG] Code redeemed successfully:", data);
  return data;
}

export async function createCode(packageType: string, metadata?: any) {
  console.log("🔍 [SUPABASE DEBUG] Creating code for package:", packageType);
  
  // Generate a random code (8 characters, alphanumeric)
  const code = Math.random().toString(36).substring(2, 10).toUpperCase();
  
  const { data, error } = await supabase
    .from('codes')
    .insert({
      code,
      package_type: packageType,
      metadata: metadata || {}
    })
    .select()
    .single();
  
  if (error) {
    console.error("❌ [SUPABASE DEBUG] Error creating code:", error);
    throw error;
  }
  
  console.log("✅ [SUPABASE DEBUG] Code created successfully:", data);
  return data;
}
