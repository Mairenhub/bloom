import { NextRequest, NextResponse } from 'next/server';
import { enhancePromptForKlingAI } from '@/lib/openai';
import { supabaseAdmin } from '@/lib/supabase';

// Helper function to upload base64 image to Supabase Storage
async function uploadImageToStorage(base64Data: string, filename: string): Promise<string> {
  // Remove data URL prefix if present
  const base64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '');
  
  // Convert base64 to buffer
  const buffer = Buffer.from(base64, 'base64');
  
  // Upload to Supabase Storage using admin client
  const { data, error } = await supabaseAdmin.storage
    .from('images')
    .upload(filename, buffer, {
      contentType: 'image/jpeg',
      upsert: true
    });
  
  if (error) {
    throw new Error(`Failed to upload image: ${error.message}`);
  }
  
  // Return the public URL
  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('images')
    .getPublicUrl(filename);
  
  return publicUrl;
}

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
      
      // Use the pre-uploaded image URLs
      const fromImageUrl = frame.imageUrl;
      const toImageUrl = nextFrame.imageUrl;
      
      // Download images for OpenAI enhancement (we still need base64 for that)
      console.log(`📥 [BATCH SUBMIT] Downloading images for enhancement...`);
      const fromImageResponse = await fetch(fromImageUrl);
      const toImageResponse = await fetch(toImageUrl);
      
      if (!fromImageResponse.ok || !toImageResponse.ok) {
        throw new Error('Failed to download images for enhancement');
      }
      
      const fromImageBuffer = await fromImageResponse.arrayBuffer();
      const toImageBuffer = await toImageResponse.arrayBuffer();
      
      const fromImageBase64 = Buffer.from(fromImageBuffer).toString('base64');
      const toImageBase64 = Buffer.from(toImageBuffer).toString('base64');
      
      // Enhance the prompt using the downloaded images
      const enhancedData = await enhancePromptForKlingAI(transitionPrompt, {
        fromImage: fromImageBase64,
        toImage: toImageBase64,
        duration: parseInt(duration),
        style: aspectRatio
      });
      
      const taskData = {
        taskId,
        sessionId,
        frameId: frame.id,
        nextFrameId: nextFrame.id,
        originalPrompt: transitionPrompt,
        enhancedPrompt: enhancedData.enhancedPrompt,
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
