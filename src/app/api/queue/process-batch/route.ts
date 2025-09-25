import { NextRequest, NextResponse } from 'next/server';

// This will be called by the server to process a batch
export async function POST(request: NextRequest) {
  try {
    const { sessionId, email } = await request.json();
    
    console.log('🔄 [BATCH PROCESS] Starting batch processing for session:', sessionId);

    // Process the queue for this session
    await processBatchQueue(sessionId, email);

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('❌ [BATCH PROCESS] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

async function processBatchQueue(sessionId: string, email?: string) {
  const pollInterval = 30000; // 30 seconds
  const maxWaitTime = 30 * 60 * 1000; // 30 minutes max
  
  const startTime = Date.now();
  let completedVideos = 0;
  let totalVideos = 0;
  let allVideosComplete = false;

  console.log('🎬 [BATCH PROCESS] Starting queue processing for session:', sessionId);

  // Get initial video count
  try {
    const statusResponse = await fetch(`http://localhost:3000/api/queue/status?sessionId=${sessionId}`);
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      totalVideos = statusData.total || 0;
      console.log(`📊 [BATCH PROCESS] Found ${totalVideos} videos for session ${sessionId}`);
    }
  } catch (error) {
    console.error('❌ [BATCH PROCESS] Error getting initial status:', error);
  }

  // Process queue until all videos are complete or timeout
  while (!allVideosComplete && (Date.now() - startTime) < maxWaitTime) {
    try {
      // Process the queue (this will pick up queued tasks and send them to KlingAI)
      const processResponse = await fetch(`http://localhost:3000/api/queue/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!processResponse.ok) {
        console.error('❌ [BATCH PROCESS] Error processing queue:', await processResponse.text());
      }

      // Check status of all videos for this session
      const statusResponse = await fetch(`http://localhost:3000/api/queue/status?sessionId=${sessionId}`);
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        const { completed, failed, total } = statusData;
        
        completedVideos = completed + failed;
        allVideosComplete = completedVideos >= total;
        
        console.log(`📊 [BATCH PROCESS] Session ${sessionId}: ${completed} completed, ${failed} failed, ${total} total`);
        
        if (allVideosComplete) {
          console.log('✅ [BATCH PROCESS] All videos complete for session:', sessionId);
          
          // If we have completed videos, combine them and send email
          if (completed > 0) {
            await handleBatchCompletion(sessionId, completed, email);
          }
          break;
        }
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollInterval));

    } catch (error) {
      console.error('❌ [BATCH PROCESS] Error in processing loop:', error);
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  if (!allVideosComplete) {
    console.warn('⏰ [BATCH PROCESS] Timeout reached for session:', sessionId);
  }
}

async function handleBatchCompletion(sessionId: string, completedCount: number, email?: string) {
  try {
    console.log('🎉 [BATCH COMPLETE] Handling completion for session:', sessionId);

    // Combine all completed videos
    const combineResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/videos/combine`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        sessionId,
        type: 'batch',
        metadata: {
          totalVideos: completedCount,
          combinedAt: new Date().toISOString()
        }
      })
    });

    if (!combineResponse.ok) {
      throw new Error('Failed to combine videos');
    }

    const combineData = await combineResponse.json();
    const downloadLink = combineData.downloadUrl;

    console.log('🔗 [BATCH COMPLETE] Generated download link:', downloadLink);

    // Send email notification if email provided
    if (email && downloadLink) {
      try {
        const emailResponse = await fetch(`http://localhost:3000/api/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            downloadUrl: downloadLink,
            sessionId,
            type: 'download'
          })
        });

        if (emailResponse.ok) {
          console.log('📧 [BATCH COMPLETE] Email sent successfully to:', email);
        } else {
          console.error('❌ [BATCH COMPLETE] Failed to send email:', await emailResponse.text());
        }
      } catch (emailError) {
        console.error('❌ [BATCH COMPLETE] Email sending error:', emailError);
      }
    }

  } catch (error) {
    console.error('❌ [BATCH COMPLETE] Error handling completion:', error);
  }
}
