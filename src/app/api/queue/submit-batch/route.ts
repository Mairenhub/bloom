import { NextRequest, NextResponse } from 'next/server';
import { enhancePromptForKlingAI } from '@/lib/openai';


export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      sessionId, 
      framePairs, 
      transitionPrompts, 
      duration, 
      aspectRatio, 
      code,
      email 
    } = body;

    console.log('🎬 [BATCH SUBMIT] Starting batch submission:', { sessionId, frameCount: framePairs.length });

    // Validate code first
    const codeResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/codes/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    if (!codeResponse.ok) {
      return NextResponse.json({ error: 'Invalid access code' }, { status: 400 });
    }

    const codeData = await codeResponse.json();
    if (!codeData.valid) {
      return NextResponse.json({ error: 'Invalid access code' }, { status: 400 });
    }

    // Redeem the code to make it unusable
    const redeemResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/codes/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });

    if (!redeemResponse.ok) {
      return NextResponse.json({ error: 'Failed to redeem code' }, { status: 400 });
    }

    const redeemedData = await redeemResponse.json();
    console.log('✅ [BATCH SUBMIT] Code redeemed successfully:', redeemedData);

    // Create batch job record
    const batchJob = {
      sessionId,
      status: 'queued',
      totalVideos: framePairs.length,
      completedVideos: 0,
      email: email || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // Store batch job in database (you'll need to create this table)
    // For now, we'll store it in a simple way
    console.log('📝 [BATCH SUBMIT] Created batch job:', batchJob);

    // Submit each video to the queue
    const videoTasks = [];
    
    for (let i = 0; i < framePairs.length; i++) {
      const [frame, nextFrame] = framePairs[i];
      const taskId = `batch-${sessionId}-${frame.id}-${Date.now()}-${i}`;
      
      // Get transition prompt
      const transitionPrompt = transitionPrompts[`${frame.id}-${nextFrame.id}`] || `Smooth transition from frame ${frame.id} to ${nextFrame.id}`;
      
      // Use the existing image URLs from the uploaded images
      console.log(`🔗 [BATCH SUBMIT] Using existing image URLs for task ${taskId}...`);
      const fromImageUrl = frame.image; // Use the existing public URL
      const toImageUrl = nextFrame.image; // Use the existing public URL
      
      const taskData = {
        taskId,
        sessionId,
        frameId: frame.id,
        nextFrameId: nextFrame.id,
        originalPrompt: transitionPrompt,
        // We will enhance prompt during processing after fetching images
        duration,
        aspectRatio,
        videoIndex: i + 1,
        totalVideos: framePairs.length,
        batchId: sessionId,
        status: 'queued',
        created_at: new Date().toISOString(),
        // Store only image URLs, not the actual image data
        fromImageUrl,
        toImageUrl
      };

      // Submit to queue
      const queueResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/queue/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          sessionId,
          frameId: frame.id,
          priority: 0,
          taskData,
          accountId: 'default'
        })
      });

      if (queueResponse.ok) {
        videoTasks.push(taskData);
        console.log(`✅ [BATCH SUBMIT] Queued video ${i + 1}/${framePairs.length}:`, taskId);
      } else {
        console.error(`❌ [BATCH SUBMIT] Failed to queue video ${i + 1}:`, await queueResponse.text());
      }
    }

    // Start the server-side processing
    // This will be handled by a background process
    setTimeout(async () => {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/queue/process-batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, email })
        });
        console.log('🚀 [BATCH SUBMIT] Started background processing for session:', sessionId);
      } catch (error) {
        console.error('❌ [BATCH SUBMIT] Error starting batch processing:', error);
      }
    }, 1000);

    // Get queue position for the first task to show estimated wait time
    let queueInfo = null;
    if (videoTasks.length > 0) {
      try {
        const positionResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/queue/position?taskId=${videoTasks[0].taskId}`);
        if (positionResponse.ok) {
          queueInfo = await positionResponse.json();
        }
      } catch (error) {
        console.warn("⚠️ [BATCH SUBMIT] Failed to get queue position:", error);
      }
    }

    return NextResponse.json({ 
      success: true, 
      sessionId,
      queuedVideos: videoTasks.length,
      message: email ? 'Video generation started. You will receive an email when complete.' : 'Video generation started on our servers.',
      queueInfo: queueInfo ? {
        position: queueInfo.position,
        totalInQueue: queueInfo.totalInQueue,
        estimatedWaitMinutes: queueInfo.estimatedWaitMinutes,
        estimatedCompletionTime: queueInfo.estimatedCompletionTime
      } : null
    });

  } catch (error) {
    console.error('❌ [BATCH SUBMIT] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
