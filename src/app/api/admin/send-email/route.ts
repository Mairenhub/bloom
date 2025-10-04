import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { sessionId, force = false } = body;
    
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
    }

    console.log(`🔍 [ADMIN EMAIL] Checking session: ${sessionId}`);

    // Get session details
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('video_sessions')
      .select('*')
      .eq('session_id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error('❌ [ADMIN EMAIL] Session not found:', sessionError);
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    console.log(`📊 [ADMIN EMAIL] Session found:`, {
      sessionId: session.session_id,
      email: session.email ? session.email.substring(0, 3) + '***' : 'No email',
      emailSent: session.email_sent,
      totalVideos: session.total_videos,
      completedVideos: session.completed_videos
    });

    if (!session.email) {
      return NextResponse.json({ error: 'No email associated with this session' }, { status: 400 });
    }

    if (session.email_sent && !force) {
      return NextResponse.json({ 
        message: 'Email already sent for this session. Use force=true to resend.',
        emailSent: true 
      }, { status: 200 });
    }

    // Check if all videos are completed
    const { data: videos, error: videosError } = await supabaseAdmin
      .from('videos')
      .select('*')
      .eq('session_id', sessionId)
      .eq('status', 'completed')
      .not('video_url', 'is', null)
      .order('frame_id', { ascending: true });

    if (videosError) {
      console.error('❌ [ADMIN EMAIL] Error fetching videos:', videosError);
      return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
    }

    if (!videos || videos.length === 0) {
      return NextResponse.json({ error: 'No completed videos found for this session' }, { status: 400 });
    }

    console.log(`📹 [ADMIN EMAIL] Found ${videos.length} completed videos`);

    // Combine videos
    const videoUrls = videos.map(video => video.video_url);
    
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
      console.error('❌ [ADMIN EMAIL] Failed to combine videos:', errorText);
      return NextResponse.json({ error: `Failed to combine videos: ${errorText}` }, { status: 500 });
    }

    const combineData = await combineResponse.json();
    const downloadLink = combineData.url;

    console.log('🔗 [ADMIN EMAIL] Generated download link:', downloadLink);

    // Send email
    const emailResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/send-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: session.email,
        downloadUrl: downloadLink,
        sessionId,
        type: 'download'
      })
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error('❌ [ADMIN EMAIL] Failed to send email:', errorText);
      return NextResponse.json({ error: `Failed to send email: ${errorText}` }, { status: 500 });
    }

    const emailData = await emailResponse.json();

    // Mark email as sent
    const { error: updateError } = await supabaseAdmin
      .from('video_sessions')
      .update({ 
        email_sent: true,
        updated_at: new Date().toISOString()
      })
      .eq('session_id', sessionId);

    if (updateError) {
      console.error('❌ [ADMIN EMAIL] Failed to mark email as sent:', updateError);
    }

    console.log('✅ [ADMIN EMAIL] Email sent successfully:', {
      sessionId,
      email: session.email.substring(0, 3) + '***',
      messageId: emailData.messageId
    });

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
      sessionId,
      emailSent: true,
      downloadLink,
      messageId: emailData.messageId
    });

  } catch (error) {
    console.error('💥 [ADMIN EMAIL] Error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
