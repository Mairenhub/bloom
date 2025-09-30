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
    const statusResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/queue/status?sessionId=${sessionId}`);
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
      const processResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/queue/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!processResponse.ok) {
        console.error('❌ [BATCH PROCESS] Error processing queue:', await processResponse.text());
      }

      // Check status of videos that are being processed by KlingAI
      const statusCheckResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/videos/check-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (statusCheckResponse.ok) {
        const statusData = await statusCheckResponse.json();
        console.log(`📊 [BATCH PROCESS] Video status check:`, statusData);
      }

      // Check status of all videos for this session
      const statusResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/queue/status?sessionId=${sessionId}`);
      
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        const { status } = statusData;
        
        const completed = status.completed || 0;
        const failed = status.failed || 0;
        const total = statusData.total || 0;
        
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

    // Get all videos for this session (completed, failed, processing)
    const videosResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/videos?sessionId=${sessionId}`);
    if (!videosResponse.ok) {
      throw new Error('Failed to get videos for session');
    }

    const videosData = await videosResponse.json();
    const allVideos = videosData.videos?.filter((video: any) => 
      video.session_id === sessionId
    ) || [];

    const completedVideos = allVideos.filter((video: any) => 
      video.status === 'completed' && 
      video.video_url
    );

    const failedVideos = allVideos.filter((video: any) => 
      video.status === 'failed'
    );

    const processingVideos = allVideos.filter((video: any) => 
      video.status === 'processing' || video.status === 'submitted'
    );

    console.log(`📊 [BATCH COMPLETE] Video status breakdown:`, {
      completed: completedVideos.length,
      failed: failedVideos.length,
      processing: processingVideos.length,
      total: allVideos.length
    });

    // Log frame IDs for debugging
    console.log(`🔍 [BATCH COMPLETE] Frame IDs - Completed:`, completedVideos.map((v: any) => v.frame_id));
    console.log(`🔍 [BATCH COMPLETE] Frame IDs - Failed:`, failedVideos.map((v: any) => v.frame_id));
    console.log(`🔍 [BATCH COMPLETE] Frame IDs - Processing:`, processingVideos.map((v: any) => v.frame_id));

    if (completedVideos.length === 0) {
      console.log('⚠️ [BATCH COMPLETE] No completed videos found for session:', sessionId);
      return;
    }

    console.log(`📹 [BATCH COMPLETE] Found ${completedVideos.length} completed videos for combination`);

    // Sort videos by frame_id to ensure correct order
    const sortedVideos = completedVideos.sort((a: any, b: any) => {
      const frameA = parseInt(a.frame_id) || 0;
      const frameB = parseInt(b.frame_id) || 0;
      return frameA - frameB;
    });

    console.log(`🔄 [BATCH COMPLETE] Videos sorted by frame order:`, sortedVideos.map((v: any) => `frame_${v.frame_id}`));

    // Check for missing frames and validate completion
    const completedFrameIds = sortedVideos.map((v: any) => parseInt(v.frame_id)).sort((a: any, b: any) => a - b);
    
    // Find the actual range of frame IDs that should exist
    const minFrameId = Math.min(...completedFrameIds);
    const maxFrameId = Math.max(...completedFrameIds);
    const expectedFrameIds = Array.from({ length: maxFrameId - minFrameId + 1 }, (_, i) => minFrameId + i);
    const missingFrameIds = expectedFrameIds.filter(id => !completedFrameIds.includes(id));
    
    if (missingFrameIds.length > 0) {
      console.warn(`⚠️ [BATCH COMPLETE] Missing frame IDs:`, missingFrameIds);
      console.warn(`⚠️ [BATCH COMPLETE] This will result in a video with gaps!`);
      
      // Check if any missing frames are still processing
      const missingFramesStillProcessing = missingFrameIds.some(frameId => 
        processingVideos.some((v: any) => parseInt(v.frame_id) === frameId)
      );
      
      if (missingFramesStillProcessing) {
        console.log(`⏳ [BATCH COMPLETE] Some missing frames are still processing, waiting...`);
        return; // Don't complete the batch yet
      } else {
        // Check if we can retry failed frames
        const failedFrames = failedVideos.filter((v: any) => 
          missingFrameIds.includes(parseInt(v.frame_id))
        );
        
        if (failedFrames.length > 0) {
          console.log(`🔄 [BATCH COMPLETE] Attempting to retry ${failedFrames.length} failed frames...`);
          
          try {
            const retryResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/queue/retry-failed`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ sessionId })
            });
            
            if (retryResponse.ok) {
              const retryData = await retryResponse.json();
              console.log(`✅ [BATCH COMPLETE] Retry initiated:`, retryData);
              return; // Wait for retry to complete
            } else {
              console.error(`❌ [BATCH COMPLETE] Retry failed:`, await retryResponse.text());
            }
          } catch (retryError) {
            console.error(`❌ [BATCH COMPLETE] Retry error:`, retryError);
          }
        }
        
        console.warn(`❌ [BATCH COMPLETE] Missing frames are not processing, proceeding with incomplete video`);
      }
    }

    // Extract video URLs in correct order
    const videoUrls = sortedVideos.map((video: any) => video.video_url);

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

    // Send email notification if email provided
    if (email && downloadLink) {
      try {
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
