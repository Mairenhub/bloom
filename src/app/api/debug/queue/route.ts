import { NextRequest } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return new Response(JSON.stringify({ 
        error: "sessionId is required" 
      }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log(`🔍 [DEBUG QUEUE] Inspecting queue for session: ${sessionId}`);

    // Get all queue tasks for this session
    const { data: queueTasks, error: queueError } = await supabaseAdmin
      .from('video_queue')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (queueError) {
      console.error("❌ [DEBUG QUEUE] Error fetching queue tasks:", queueError);
      throw queueError;
    }

    // Get all videos for this session
    const { data: videos, error: videosError } = await supabaseAdmin
      .from('videos')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (videosError) {
      console.error("❌ [DEBUG QUEUE] Error fetching videos:", videosError);
      throw videosError;
    }

    // Analyze the data
    const analysis = {
      sessionId,
      queueTasks: queueTasks?.length || 0,
      videos: videos?.length || 0,
      queueStatusBreakdown: {},
      videoStatusBreakdown: {},
      frameIdAnalysis: {},
      issues: []
    };

    // Queue status breakdown
    if (queueTasks) {
      const queueStatusCounts = queueTasks.reduce((acc: any, task) => {
        acc[task.status] = (acc[task.status] || 0) + 1;
        return acc;
      }, {});
      analysis.queueStatusBreakdown = queueStatusCounts;
    }

    // Video status breakdown
    if (videos) {
      const videoStatusCounts = videos.reduce((acc: any, video) => {
        acc[video.status] = (acc[video.status] || 0) + 1;
        return acc;
      }, {});
      analysis.videoStatusBreakdown = videoStatusCounts;
    }

    // Frame ID analysis
    if (queueTasks && videos) {
      const queueFrameIds = queueTasks.map(t => t.frame_id).filter(Boolean).sort();
      const videoFrameIds = videos.map(v => v.frame_id).filter(Boolean).sort();
      
      analysis.frameIdAnalysis = {
        queueFrameIds,
        videoFrameIds,
        missingInVideos: queueFrameIds.filter(id => !videoFrameIds.includes(id)),
        missingInQueue: videoFrameIds.filter(id => !queueFrameIds.includes(id))
      };
    }

    // Check for issues
    if (queueTasks) {
      const failedTasks = queueTasks.filter(t => t.status === 'failed');
      if (failedTasks.length > 0) {
        analysis.issues.push(`Found ${failedTasks.length} failed queue tasks`);
      }

      const stuckProcessing = queueTasks.filter(t => 
        t.status === 'processing' && 
        t.started_at && 
        (Date.now() - new Date(t.started_at).getTime()) > 300000 // 5 minutes
      );
      if (stuckProcessing.length > 0) {
        analysis.issues.push(`Found ${stuckProcessing.length} potentially stuck processing tasks`);
      }
    }

    if (videos) {
      const failedVideos = videos.filter(v => v.status === 'failed');
      if (failedVideos.length > 0) {
        analysis.issues.push(`Found ${failedVideos.length} failed videos`);
      }
    }

    // Check for missing frame sequences
    if (queueTasks) {
      const completedFrameIds = queueTasks
        .filter(t => t.status === 'completed')
        .map(t => parseInt(t.frame_id))
        .filter(id => !isNaN(id))
        .sort((a, b) => a - b);
      
      if (completedFrameIds.length > 0) {
        const expectedIds = Array.from({ length: Math.max(...completedFrameIds) }, (_, i) => i + 1);
        const missingIds = expectedIds.filter(id => !completedFrameIds.includes(id));
        if (missingIds.length > 0) {
          analysis.issues.push(`Missing frame IDs in completed tasks: ${missingIds.join(', ')}`);
        }
      }
    }

    console.log(`📊 [DEBUG QUEUE] Analysis complete:`, analysis);

    return new Response(JSON.stringify(analysis), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("💥 [DEBUG QUEUE] Error analyzing queue:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Failed to analyze queue" 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
