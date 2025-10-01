import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  try {
    console.log("🔍 [COMPLETED CHECK] Checking for completed batches...");
    
    // Get all sessions that have completed videos but no email sent
    const { data: sessions, error } = await supabaseAdmin
      .from('video_sessions')
      .select(`
        session_id,
        email,
        total_videos,
        completed_videos,
        created_at
      `)
      .not('email', 'is', null)
      .eq('email_sent', false)
      .gte('completed_videos', 1);

    if (error) {
      console.error("❌ [COMPLETED CHECK] Error fetching sessions:", error);
      return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
    }

    if (!sessions || sessions.length === 0) {
      console.log("ℹ️ [COMPLETED CHECK] No completed sessions found");
      return NextResponse.json({ message: "No completed sessions found" });
    }

    console.log(`📊 [COMPLETED CHECK] Found ${sessions.length} sessions to check`);

    const results = [];

    for (const session of sessions) {
      try {
        console.log(`🔍 [COMPLETED CHECK] Checking session: ${session.session_id}`);
        
        // Check if all videos for this session are completed
        const { data: videos, error: videosError } = await supabaseAdmin
          .from('videos')
          .select('status, video_url')
          .eq('session_id', session.session_id);

        if (videosError) {
          console.error(`❌ [COMPLETED CHECK] Error fetching videos for session ${session.session_id}:`, videosError);
          continue;
        }

        const completedVideos = videos?.filter(v => v.status === 'completed' && v.video_url) || [];
        const totalVideos = videos?.length || 0;
        const allCompleted = completedVideos.length === totalVideos && totalVideos > 0;

        console.log(`📊 [COMPLETED CHECK] Session ${session.session_id}: ${completedVideos.length}/${totalVideos} completed`);

        if (allCompleted) {
          console.log(`✅ [COMPLETED CHECK] Session ${session.session_id} is fully completed, processing...`);
          
          // Process the completed batch
          const result = await processCompletedBatch(session.session_id, session.email);
          results.push({
            sessionId: session.session_id,
            email: session.email,
            status: result.success ? 'processed' : 'failed',
            error: result.error
          });

          // Mark email as sent
          if (result.success) {
            await supabaseAdmin
              .from('video_sessions')
              .update({ email_sent: true })
              .eq('session_id', session.session_id);
          }
        }
      } catch (error) {
        console.error(`❌ [COMPLETED CHECK] Error processing session ${session.session_id}:`, error);
        results.push({
          sessionId: session.session_id,
          email: session.email,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return NextResponse.json({
      message: "Completed batch check finished",
      processed: results.length,
      results
    });

  } catch (error) {
    console.error("💥 [COMPLETED CHECK] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

async function processCompletedBatch(sessionId: string, email: string) {
  try {
    console.log(`🎉 [BATCH COMPLETE] Processing completed batch for session: ${sessionId}`);

    // Get all completed videos for this session
    const { data: videos, error } = await supabaseAdmin
      .from('videos')
      .select('*')
      .eq('session_id', sessionId)
      .eq('status', 'completed')
      .not('video_url', 'is', null)
      .order('frame_id', { ascending: true });

    if (error) {
      throw new Error(`Failed to get videos: ${error.message}`);
    }

    if (!videos || videos.length === 0) {
      throw new Error('No completed videos found');
    }

    console.log(`📹 [BATCH COMPLETE] Found ${videos.length} completed videos for combination`);

    // Extract video URLs in correct order
    const videoUrls = videos.map(video => video.video_url);

    // Combine all completed videos
    const combineResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/videos/combine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        sessionId,
        videoUrls,
        duration: 5,
        aspectRatio: '16:9'
      })
    });

    if (!combineResponse.ok) {
      const errorText = await combineResponse.text();
      throw new Error(`Failed to combine videos: ${errorText}`);
    }

    const combineData = await combineResponse.json();
    const downloadLink = combineData.url;

    console.log('🔗 [BATCH COMPLETE] Generated download link:', downloadLink);

    // Send email notification
    const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        downloadUrl: downloadLink,
        sessionId,
        type: 'download'
      })
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      throw new Error(`Failed to send email: ${errorText}`);
    }

    console.log('📧 [BATCH COMPLETE] Email sent successfully to:', email);

    return { success: true };

  } catch (error) {
    console.error('❌ [BATCH COMPLETE] Error processing completed batch:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
  }
}
