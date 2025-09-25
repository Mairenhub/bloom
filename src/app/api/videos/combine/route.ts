import { NextRequest } from "next/server";
import { supabase, uploadVideo } from "@/lib/supabase";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, mkdtemp } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const execAsync = promisify(exec);

// Function to combine videos using FFmpeg
async function combineVideosWithFFmpeg(videoBlobs: Blob[], outputPath: string): Promise<void> {
  console.log(`🔗 [COMBINE] Combining ${videoBlobs.length} videos using FFmpeg`);
  
  if (videoBlobs.length === 1) {
    // If only one video, just copy it
    const arrayBuffer = await videoBlobs[0].arrayBuffer();
    await writeFile(outputPath, Buffer.from(arrayBuffer));
    return;
  }
  
  // Create temporary directory for input files
  const tempDir = await mkdtemp(join(tmpdir(), 'video-combine-'));
  const inputFiles: string[] = [];
  
  try {
    // Write each video blob to a temporary file
    for (let i = 0; i < videoBlobs.length; i++) {
      const inputPath = join(tempDir, `input_${i}.mp4`);
      const arrayBuffer = await videoBlobs[i].arrayBuffer();
      await writeFile(inputPath, Buffer.from(arrayBuffer));
      inputFiles.push(inputPath);
      console.log(`📁 [COMBINE] Created temp file ${i + 1}: ${inputPath}`);
    }
    
    // Create FFmpeg concat file
    const concatFilePath = join(tempDir, 'concat.txt');
    const concatContent = inputFiles.map(file => `file '${file}'`).join('\n');
    await writeFile(concatFilePath, concatContent);
    console.log(`📝 [COMBINE] Created concat file: ${concatContent}`);
    
    // Run FFmpeg to concatenate videos
    const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${concatFilePath}" -c copy "${outputPath}" -y`;
    console.log(`🎬 [COMBINE] Running FFmpeg: ${ffmpegCommand}`);
    
    const { stdout, stderr } = await execAsync(ffmpegCommand);
    console.log(`✅ [COMBINE] FFmpeg completed successfully`);
    console.log(`📊 [COMBINE] FFmpeg stdout: ${stdout}`);
    if (stderr) console.log(`⚠️ [COMBINE] FFmpeg stderr: ${stderr}`);
    
  } finally {
    // Clean up temporary files
    for (const file of inputFiles) {
      try {
        await unlink(file);
      } catch (error) {
        console.warn(`⚠️ [COMBINE] Failed to delete temp file ${file}:`, error);
      }
    }
    try {
      await unlink(join(tempDir, 'concat.txt'));
      await unlink(tempDir);
    } catch (error) {
      console.warn(`⚠️ [COMBINE] Failed to clean up temp directory:`, error);
    }
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log("🎬 [COMBINE DEBUG] Starting video combination request");
    
    const body = await req.json();
    const { sessionId, videoUrls, duration, aspectRatio } = body;
    
    if (!sessionId || !videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
      return new Response(JSON.stringify({ 
        error: "sessionId and videoUrls array are required" 
      }), { status: 400 });
    }

    console.log("🎬 [COMBINE DEBUG] Combining videos:", {
      sessionId,
      videoCount: videoUrls.length,
      videoUrls: videoUrls.map((url, i) => `video_${i}: ${url.substring(0, 50)}...`),
      duration,
      aspectRatio
    });

    const combinedVideoId = `combined-${sessionId}-${Date.now()}`;
    
    try {
      // Download all videos
      console.log("📥 [COMBINE DEBUG] Downloading videos...");
      const videoBlobs: Blob[] = [];
      
      for (let i = 0; i < videoUrls.length; i++) {
        const videoUrl = videoUrls[i];
        console.log(`📥 [COMBINE DEBUG] Downloading video ${i + 1}/${videoUrls.length}: ${videoUrl.substring(0, 50)}...`);
        
        const response = await fetch(videoUrl);
        if (!response.ok) {
          throw new Error(`Failed to download video ${i + 1}: ${response.statusText}`);
        }
        
        const blob = await response.blob();
        videoBlobs.push(blob);
        console.log(`✅ [COMBINE DEBUG] Downloaded video ${i + 1}: ${blob.size} bytes`);
      }

      // Create temporary output file
      const tempDir = await mkdtemp(join(tmpdir(), 'video-output-'));
      const outputPath = join(tempDir, `${combinedVideoId}.mp4`);
      
      // Combine videos using FFmpeg
      console.log("🔗 [COMBINE DEBUG] Combining videos with FFmpeg...");
      await combineVideosWithFFmpeg(videoBlobs, outputPath);
      
      // Read the combined video file
      const combinedVideoBuffer = await import('fs').then(fs => fs.promises.readFile(outputPath));
      const combinedFile = new File([new Uint8Array(combinedVideoBuffer)], `${combinedVideoId}.mp4`, { type: 'video/mp4' });
      
      // Upload combined video to storage
      console.log("📤 [COMBINE DEBUG] Uploading combined video...");
      const combinedVideoUrl = await uploadVideo(combinedFile, combinedVideoId);
      
      // Clean up temporary output file
      try {
        await unlink(outputPath);
        await unlink(tempDir);
      } catch (error) {
        console.warn(`⚠️ [COMBINE] Failed to clean up output files:`, error);
      }
      
      // Save combined video to database
      await supabase
        .from('videos')
        .insert({
          task_id: combinedVideoId,
          session_id: sessionId,
          status: 'succeed',
          video_url: combinedVideoUrl,
          is_combined: true,
          metadata: {
            original_video_count: videoUrls.length,
            duration: duration || 5,
            aspect_ratio: aspectRatio || '16:9',
            combined_at: new Date().toISOString()
          }
        });

      console.log("✅ [COMBINE DEBUG] Video combination completed:", {
        combinedVideoId,
        combinedVideoUrl: combinedVideoUrl.substring(0, 50) + "...",
        originalCount: videoUrls.length
      });

      return new Response(JSON.stringify({
        success: true,
        taskId: combinedVideoId,
        url: combinedVideoUrl,
        status: 'succeed',
        message: `Successfully combined ${videoUrls.length} videos`
      }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      });

    } catch (combineError) {
      console.error("❌ [COMBINE DEBUG] Error during combination:", combineError);
      
      // Save failed combination to database
      await supabase
        .from('videos')
        .insert({
          task_id: combinedVideoId,
          session_id: sessionId,
          status: 'failed',
          error_message: combineError instanceof Error ? combineError.message : 'Unknown error',
          is_combined: true
        });

      throw combineError;
    }

  } catch (error: any) {
    console.error("❌ [COMBINE DEBUG] Error combining videos:", error);
    return new Response(JSON.stringify({ 
      error: error?.message || "Failed to combine videos" 
    }), { status: 500 });
  }
}