"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, ArrowLeftRight, Upload, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Frame = {
  id: string;
  image?: string;
};

type Transition = {
  fromFrameId: string;
  toFrameId: string;
  text: string;
};

type TaskInfo = {
  frameId: string;
  taskId: string;
  status: "queued" | "submitted" | "processing" | "succeed" | "failed";
  url?: string;
  error?: string;
  originalPrompt?: string;
  enhancedPrompt?: string;
  characterIdentity?: {
    characterName: string;
    idCard: string;
    description: string;
    outfit: string;
  };
  videoIndex?: number;
  totalVideos?: number;
};

type CombinedVideo = {
  id: string;
  url: string;
  status: "processing" | "succeed" | "failed";
  error?: string;
};

function useInitialFrames(): Frame[] {
  return useMemo(
    () => [
      { id: "1" },
      { id: "2" },
    ],
    []
  );
}

function UploadSlot({
  value,
  onChange,
  title,
}: {
  value?: string;
  onChange: (src?: string) => void;
  title: string;
}) {
  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => onChange(typeof reader.result === "string" ? reader.result : undefined);
    reader.readAsDataURL(file);
  };

  return (
    <label className="flex h-48 w-full cursor-pointer items-center justify-center rounded-lg border bg-muted/30 sm:h-56">
      {value ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt={title} className="h-full w-full rounded-lg object-cover" />
      ) : (
        <div className="text-muted-foreground flex flex-col items-center gap-1 text-xs">
          <Upload className="size-4" />
          {title}
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
        className="hidden"
      />
    </label>
  );
}

export default function StoryboardPage() {
  const [frames, setFrames] = useState<Frame[]>(useInitialFrames());
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [mode, setMode] = useState<"std" | "pro">("std");
  const [duration, setDuration] = useState<"5" | "10">("5");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16" | "1:1">("16:9");
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [combinedVideo, setCombinedVideo] = useState<CombinedVideo | null>(null);
  const [isCombining, setIsCombining] = useState(false);
  const [queueStatus, setQueueStatus] = useState<{
    queued: number;
    processing: number;
    completed: number;
    failed: number;
  } | null>(null);
  const pollers = useRef<Record<string, number>>({});

  const switchImages = (frameId1: string, frameId2: string) => {
    setFrames((prev) =>
      prev.map((f) => {
        if (f.id === frameId1) {
          const frame2 = prev.find(f2 => f2.id === frameId2);
          return { ...f, image: frame2?.image };
        }
        if (f.id === frameId2) {
          const frame1 = prev.find(f1 => f1.id === frameId1);
          return { ...f, image: frame1?.image };
        }
        return f;
      })
    );
  };

  const removeFrame = (frameId: string) => {
    setFrames((prev) => {
      if (prev.length <= 2) return prev; // Minimum 2 frames
      return prev.filter(f => f.id !== frameId);
    });
    // Also remove transitions involving this frame
    setTransitions((prev) => 
      prev.filter(t => t.fromFrameId !== frameId && t.toFrameId !== frameId)
    );
  };

  const updateTransition = (fromFrameId: string, toFrameId: string, text: string) => {
    setTransitions((prev) => {
      const existing = prev.find(t => t.fromFrameId === fromFrameId && t.toFrameId === toFrameId);
      if (existing) {
        return prev.map(t => 
          t.fromFrameId === fromFrameId && t.toFrameId === toFrameId 
            ? { ...t, text }
            : t
        );
      } else {
        return [...prev, { fromFrameId, toFrameId, text }];
      }
    });
  };

  const getTransition = (fromFrameId: string, toFrameId: string) => {
    return transitions.find(t => t.fromFrameId === fromFrameId && t.toFrameId === toFrameId)?.text || "";
  };

  // Load videos from database and queue status on component mount
  useEffect(() => {
    loadVideosFromDatabase();
    fetchQueueStatus();
  }, []);

  useEffect(() => {
    // Set up periodic queue status refresh
    const queueStatusInterval = setInterval(() => {
      fetchQueueStatus();
    }, 10000); // Refresh every 10 seconds

    return () => {
      Object.values(pollers.current).forEach((id) => clearInterval(id));
      pollers.current = {};
      clearInterval(queueStatusInterval);
    };
  }, []);

  const loadVideosFromDatabase = async () => {
    try {
      console.log("📥 [UI DEBUG] Loading videos from database");
      const response = await fetch('/api/videos');
      const data = await response.json();
      
      if (data.videos) {
        const videoTasks: TaskInfo[] = data.videos.map((v: any) => ({
          frameId: v.frame_id,
          taskId: v.task_id,
          status: v.status,
          url: v.video_url,
          error: v.error_message
        }));
        
        console.log("✅ [UI DEBUG] Loaded videos from database:", videoTasks);
        setTasks(videoTasks);
      }
    } catch (error) {
      console.error("❌ [UI DEBUG] Error loading videos:", error);
    }
  };

  const fetchQueueStatus = async () => {
    try {
      
      const response = await fetch('/api/queue/status');
      if (response.ok) {
        const data = await response.json();
        setQueueStatus({
          queued: data.status.queued || 0,
          processing: data.status.processing || 0,
          completed: data.status.completed || 0,
          failed: data.status.failed || 0
        });
      } else {
        console.error("❌ [UI DEBUG] Failed to fetch queue status");
      }
    } catch (error) {
      console.error("❌ [UI DEBUG] Error fetching queue status:", error);
    }
  };

  const saveVideoToDatabase = async (video: TaskInfo & { sessionId?: string }) => {
    try {
      console.log("💾 [UI DEBUG] Saving video to database:", video);
      
      const response = await fetch(`/api/videos/${video.taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          frameId: video.frameId,
          sessionId: video.sessionId,
          status: video.status,
          videoUrl: video.url,
          errorMessage: video.error
        })
      });
      
      if (response.ok) {
        console.log("✅ [UI DEBUG] Video saved to database");
      } else {
        console.error("❌ [UI DEBUG] Failed to save video to database");
      }
    } catch (error) {
      console.error("❌ [UI DEBUG] Error saving video:", error);
    }
  };

  const downloadAndStoreVideo = async (taskId: string, klingUrl: string) => {
    try {
      console.log("📥 [UI DEBUG] Downloading and storing video:", { taskId, klingUrl });
      
      const response = await fetch('/api/videos/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          klingUrl,
          taskId
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log("✅ [UI DEBUG] Video stored successfully:", data.videoUrl);
        
        // Update the task with the new Supabase URL
        setTasks((prev) =>
          prev.map((t) => (t.taskId === taskId ? { ...t, url: data.videoUrl } : t))
        );
        
        // Update database with new URL
        await updateVideoInDatabase(taskId, "succeed", data.videoUrl);
      } else {
        console.error("❌ [UI DEBUG] Failed to download and store video");
      }
    } catch (error) {
      console.error("❌ [UI DEBUG] Error downloading video:", error);
    }
  };

  const updateVideoInDatabase = async (taskId: string, status: string, url?: string, error?: string) => {
    try {
      console.log("🔄 [UI DEBUG] Updating video in database:", { taskId, status, url, error });
      
      const response = await fetch(`/api/videos/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          videoUrl: url,
          errorMessage: error
        })
      });
      
      if (response.ok) {
        console.log("✅ [UI DEBUG] Video updated in database");
      } else {
        console.error("❌ [UI DEBUG] Failed to update video in database");
      }
    } catch (error) {
      console.error("❌ [UI DEBUG] Error updating video:", error);
    }
  };



  const createTaskForFrameWithPrompt = async (frame: Frame, nextFrame: Frame, prompt: string): Promise<TaskInfo | undefined> => {
    if (!frame.image || !nextFrame?.image) return;
    
    const taskId = `sb-${frame.id}-${Date.now()}`;
    
    // Calculate video index (position in the sequence)
    const videoIndex = frames.findIndex(f => f.id === frame.id);
    const totalVideos = frames.length - 1; // Total number of transitions
    
    // Prepare task data for the queue
    const taskData = {
      frameId: frame.id,
      sessionId: sessionId || undefined,
      image: frame.image, // Base image
      imageTail: nextFrame.image, // Tail image for transition
      prompt,
      negativePrompt: "no face swap, no different actor, no hairstyle change, no different clothes, no mask, no occlusion of face, no heavy motion blur",
      mode: "pro",
      duration: duration || "5",
      aspectRatio: aspectRatio || "16:9",
      videoIndex, // Position in sequence
      totalVideos, // Total videos in session
      // Character detection will be handled on the server side
    };

    try {
      // Process immediately if spots available, otherwise queue
      const response = await fetch("/api/queue/process-or-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          ...(sessionId && { sessionId }),
          frameId: frame.id,
          priority: 0,
          taskData,
          accountId: 'default'
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process or queue task");
      }

      const result = await response.json();
      console.log("✅ [UI DEBUG] Task result:", result);

      // Create task info for UI based on result
      const task = { 
        frameId: frame.id, 
        taskId, 
        status: result.processed ? "submitted" as const : "queued" as const
      };
      
      // Save task to database
      await saveVideoToDatabase({
        ...task,
        sessionId: sessionId || undefined
      });
      
      return task;
      
    } catch (error: any) {
      console.error("❌ [UI DEBUG] Error adding task to queue:", error);
      
      const failedTask = {
        frameId: frame.id,
        taskId: `failed-${frame.id}-${Date.now()}`,
        status: "failed" as const,
        error: error.message || "Failed to add task to queue",
      };
      
      // Save failed task to database
      await saveVideoToDatabase(failedTask);
      return failedTask;
    }
  };

  const checkAndCombineVideos = async () => {
    if (!sessionId) return;
    
    // Get all tasks for current session
    const sessionTasks = tasks.filter(task => 
      task.taskId.includes(sessionId) || task.taskId.startsWith('sb-')
    );
    
    // Check if all tasks are complete (succeed or failed)
    const allComplete = sessionTasks.length > 0 && sessionTasks.every(task => 
      task.status === "succeed" || task.status === "failed"
    );
    
    if (allComplete && !combinedVideo && !isCombining) {
      console.log("🎬 [UI DEBUG] All videos complete, starting combination process");
      await combineVideos();
    }
  };

  const combineVideos = async () => {
    if (!sessionId) return;
    
    setIsCombining(true);
    setCombinedVideo({
      id: `combined-${sessionId}`,
      url: "",
      status: "processing"
    });
    
    try {
      // Get all successful videos for this session
      const sessionTasks = tasks.filter(task => 
        (task.taskId.includes(sessionId) || task.taskId.startsWith('sb-')) && 
        task.status === "succeed" && 
        task.url
      );
      
      const videoUrls = sessionTasks.map(task => task.url!);
      
      console.log("🎬 [UI DEBUG] Combining videos:", videoUrls.length);
      
      const response = await fetch('/api/videos/combine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          videoUrls
        })
      });
      
      const data = await response.json();
      
      if (response.ok && data.success) {
        setCombinedVideo({
          id: data.combinedVideoId,
          url: data.combinedVideoUrl,
          status: "succeed"
        });
        console.log("✅ [UI DEBUG] Videos combined successfully");
      } else {
        throw new Error(data.error || "Failed to combine videos");
      }
    } catch (error) {
      console.error("❌ [UI DEBUG] Error combining videos:", error);
      setCombinedVideo({
        id: `combined-${sessionId}`,
        url: "",
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    } finally {
      setIsCombining(false);
    }
  };

  const pollTask = async (task: TaskInfo) => {
    // Don't poll failed tasks
    if (task.status === "failed") return;
    
    try {
      let status: TaskInfo["status"] = task.status;
      let url: string | undefined = task.url;
      
      if (task.status === "queued") {
        // For queued tasks, check the queue status and video database
        const videoRes = await fetch(`/api/videos/${encodeURIComponent(task.taskId)}`);
        if (videoRes.ok) {
          const videoData = await videoRes.json();
          status = videoData.video?.status || task.status;
          url = videoData.video?.video_url;
        }
      } else if (task.status === "submitted") {
        // For submitted tasks, check KlingAI API status
        console.log("🔍 [POLL DEBUG] Checking KlingAI status for submitted task:", task.taskId);
        try {
          const klingRes = await fetch(`/api/kling/image2video/${encodeURIComponent(task.taskId)}`);
          if (klingRes.ok) {
            const klingData = await klingRes.json();
            console.log("📡 [POLL DEBUG] KlingAI response:", klingData);
            
            if (klingData.code === 0 && klingData.data) {
              status = klingData.data.task_status;
              if (klingData.data.task_result?.videos?.[0]?.url) {
                url = klingData.data.task_result.videos[0].url;
              }
              console.log("✅ [POLL DEBUG] Updated status from KlingAI:", status, "URL:", url);
            } else {
              console.log("⚠️ [POLL DEBUG] KlingAI returned error:", klingData.message);
            }
          } else {
            console.log("❌ [POLL DEBUG] KlingAI API error:", klingRes.status);
          }
        } catch (klingError) {
          console.error("❌ [POLL DEBUG] Error calling KlingAI API:", klingError);
        }
      }
      
      // Update local state
      setTasks((prev) =>
        prev.map((t) => (t.taskId === task.taskId ? { ...t, status, url } : t))
      );
      
      // If video is ready, download and store it
      if (status === "succeed" && url) {
        await downloadAndStoreVideo(task.taskId, url);
      }
      
      // Update database
      await updateVideoInDatabase(task.taskId, status, url);
      
      if (status === "succeed" || status === "failed") {
        if (pollers.current[task.taskId]) {
          clearInterval(pollers.current[task.taskId]);
          delete pollers.current[task.taskId];
        }
        
        // Check if all videos are complete and trigger combination
        await checkAndCombineVideos();
      }
    } catch (error) {
      console.error("Error polling task:", error);
      const errorMessage = "Polling failed";
      
      // Update local state
      setTasks((prev) =>
        prev.map((t) => (t.taskId === task.taskId ? { ...t, status: "failed", error: errorMessage } : t))
      );
      
      // Update database
      await updateVideoInDatabase(task.taskId, "failed", undefined, errorMessage);
      
      if (pollers.current[task.taskId]) {
        clearInterval(pollers.current[task.taskId]);
        delete pollers.current[task.taskId];
      }
      
      // Check if all videos are complete and trigger combination
      await checkAndCombineVideos();
    }
  };

  const handleGenerate = async () => {
    if (!window.confirm("Ben je zeker? Dit zal de beelden naar KlingAI sturen.")) return;
    const candidates = frames.filter((f) => f.image);
    if (candidates.length < 2) return;

    setIsGenerating(true);
    // Don't clear previous tasks - they're now persisted in database

    try {
      // Create a new session
      const newSessionId = `session-${Date.now()}`;
      setSessionId(newSessionId);
      
      // Create frame pairs for transitions
      const framePairs = [];
      for (let i = 0; i < candidates.length - 1; i++) {
        framePairs.push([candidates[i], candidates[i + 1]]);
      }

      console.log("🚀 [UI DEBUG] Creating tasks for frame pairs:", framePairs.length);
      
      // First, generate all prompts in batch
      const transitions = framePairs.map(([frame, nextFrame]) => ({
        fromFrameId: frame.id,
        toFrameId: nextFrame.id,
        userInput: getTransition(frame.id, nextFrame.id) || ""
      }));

      console.log("🤖 [UI DEBUG] Generating batch prompts for transitions:", transitions);
      
      const promptResponse = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch',
          transitions
        })
      });

      let enhancedTransitions = transitions;
      if (promptResponse.ok) {
        const promptData = await promptResponse.json();
        if (promptData.success) {
          enhancedTransitions = promptData.transitions;
          console.log("✅ [UI DEBUG] Generated enhanced prompts:", enhancedTransitions);
        } else {
          console.log("⚠️ [UI DEBUG] Prompt generation failed, using basic prompts");
        }
      } else {
        console.log("⚠️ [UI DEBUG] Prompt API failed, using basic prompts");
      }

      // Create a map of enhanced prompts for easy lookup
      const promptMap = new Map();
      enhancedTransitions.forEach(t => {
        promptMap.set(`${t.fromFrameId}-${t.toFrameId}`, (t as any).enhancedPrompt || t.userInput);
      });

      // Create tasks for consecutive frame pairs with enhanced prompts
      const created = (await Promise.all(framePairs.map(([frame, nextFrame]) => {
        const enhancedPrompt = promptMap.get(`${frame.id}-${nextFrame.id}`) || getTransition(frame.id, nextFrame.id) || "";
        return createTaskForFrameWithPrompt(frame, nextFrame, enhancedPrompt);
      })))
        .filter(Boolean) as TaskInfo[];
      
      console.log("✅ [UI DEBUG] Created tasks:", created);
      
      // Add new tasks to existing ones instead of replacing
      setTasks(prev => [...prev, ...created]);

      created.forEach((task) => {
        console.log("🔄 [UI DEBUG] Starting polling for task:", task.taskId);
        const id = window.setInterval(() => {
          pollTask(task);
        }, 3000);
        pollers.current[task.taskId] = id as unknown as number;
      });

      // Refresh queue status after adding tasks
      fetchQueueStatus();
    } catch (error) {
      console.error("❌ [UI DEBUG] Error during generation:", error);
      alert("Er is een fout opgetreden tijdens het genereren van de video's.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col gap-6 p-6 sm:p-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold sm:text-2xl">Storyboard</h1>
        <div className="flex items-center gap-3">
          {queueStatus && (
            <div className="text-sm text-muted-foreground bg-muted/30 px-3 py-1 rounded flex items-center gap-2">
              <span className="text-blue-500">⏳ {queueStatus.queued} wachtrij</span>
              <span className="text-yellow-500">🔄 {queueStatus.processing} bezig</span>
              <span className="text-green-500">✅ {queueStatus.completed} klaar</span>
              {queueStatus.failed > 0 && (
                <span className="text-red-500">❌ {queueStatus.failed} gefaald</span>
              )}
            </div>
          )}
          {tasks.length > 0 && (
            <div className="text-sm text-muted-foreground bg-muted/30 px-3 py-1 rounded">
              💾 {tasks.length} video's opgeslagen
            </div>
          )}
        </div>
      </div>

      <div className="relative">
        <ScrollArea className="w-full rounded-xl border p-4 sm:p-6">
          <div className="flex w-max items-center gap-4 min-w-full">
          {frames.map((frame, idx) => (
            <div key={frame.id} className="flex items-center gap-4 flex-shrink-0">
              <div className="flex flex-col items-center gap-2 w-48 sm:w-56">
                <div className="flex items-center gap-2">
                  <div className="text-sm font-medium">Frame {idx + 1}</div>
                  {frames.length > 2 && (
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-6 w-6 rounded-full"
                      onClick={() => removeFrame(frame.id)}
                    >
                      <Minus className="size-3" />
                    </Button>
                  )}
                </div>
                <UploadSlot
                  title={`Frame ${idx + 1}`}
                  value={frame.image}
                  onChange={(src) =>
                    setFrames((prev) =>
                      prev.map((f) => (f.id === frame.id ? { ...f, image: src } : f))
                    )
                  }
                />
              </div>
              
              {idx < frames.length - 1 && (
                <div className="flex flex-col items-center justify-center gap-2 flex-shrink-0 w-40 sm:w-48">
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                    onClick={() => switchImages(frame.id, frames[idx + 1].id)}
                  >
                    <ArrowLeftRight className="size-5" />
                  </Button>
                  <div className="flex flex-col gap-1 w-full">
                    <Label htmlFor={`t-${frame.id}-${frames[idx + 1].id}`} className="text-xs text-center">Transitie</Label>
                    <Input
                      id={`t-${frame.id}-${frames[idx + 1].id}`}
                      value={getTransition(frame.id, frames[idx + 1].id)}
                      onChange={(e) => updateTransition(frame.id, frames[idx + 1].id, e.target.value)}
                      placeholder="overgang tekst (automatisch gecombineerd met base prompt)"
                      className="w-32 sm:w-36 text-xs"
                    />
                  </div>
                </div>
              )}
              
              {idx === frames.length - 1 && (
                <div className="flex flex-col items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    className="rounded-full"
                    onClick={() =>
                      setFrames((prev) => {
                        const newFrame: Frame = { id: `${Date.now()}` };
                        return [...prev, newFrame];
                      })
                    }
                  >
                    <Plus className="size-5" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      
      {/* Scroll hint for mobile */}
      {frames.length > 3 && (
        <div className="absolute bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
          ← Swipe om meer te zien
        </div>
      )}
      </div>

      <div className="flex justify-center">
        <Button 
          onClick={handleGenerate} 
          className="px-8" 
          disabled={isGenerating || frames.filter(f => f.image).length < 2}
        >
          {isGenerating ? "Genereren..." : "Genereer Video"}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card className="p-4">
          <CardContent className="p-0">
            <div className="rounded-lg bg-muted/30 p-4 text-sm sm:text-base">
              <div className="font-medium mb-2">💰 Kosten per Video:</div>
              <div className="text-green-600">• Kling V1.6 Standard (5s): $0.14 per video</div>
              <div className="text-xs text-muted-foreground mt-1">
                Ondersteunt frame-transities met image + image_tail - elke frame-paar wordt één 5-seconden video
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                ✨ Base training prompt automatisch gecombineerd met jouw tekst
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="p-4">
          <CardContent className="p-0">
            <div className="rounded-lg bg-muted/30 p-4 text-sm sm:text-base">
              Kies muziek uit Artlist/Epidemic Sound of onbekende muziek die we
              mogen verkopen.
            </div>
          </CardContent>
        </Card>
      </div>

      {(tasks.length > 0 || isGenerating) && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              {isGenerating ? "Genereren..." : "Gegenereerde Clips"}
            </h2>
            {tasks.length > 0 && (
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    if (window.confirm("Alle video's wissen? Dit kan niet ongedaan worden gemaakt.")) {
                      setTasks([]);
                    }
                  }}
                >
                  Wis Alle Video's
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={loadVideosFromDatabase}
                >
                  🔄 Herlaad
                </Button>
              </div>
            )}
          </div>
          
          {isGenerating && tasks.length === 0 && (
            <div className="text-center text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p>Bezig met het versturen van beelden naar KlingAI...</p>
            </div>
          )}
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {tasks.map((t) => {
              const frameIndex = frames.findIndex(f => f.id === t.frameId);
              const frameName = frameIndex >= 0 ? frameIndex + 1 : t.frameId;
              const isQueued = t.status === "queued";
              const isProcessing = t.status === "submitted" || t.status === "processing";
              const isSuccess = t.status === "succeed";
              const isFailed = t.status === "failed";
              
              return (
                <Card key={t.taskId} className="p-4">
                  <CardContent className="p-0">
                    <div className="flex items-center justify-between gap-4">
                      <div className="text-sm">
                        <div className="font-medium">Transitie: Frame {frameName} → Frame {typeof frameName === 'number' ? frameName + 1 : frameName}</div>
                        <div className="text-xs text-muted-foreground">5s video met Kling V2.1 Pro</div>
                        {t.originalPrompt && (
                          <div className="text-xs text-muted-foreground mt-1">
                            <div className="font-medium">Originele prompt:</div>
                            <div className="italic">"{t.originalPrompt}"</div>
                          </div>
                        )}
                        {t.enhancedPrompt && t.enhancedPrompt !== t.originalPrompt && (
                          <div className="text-xs text-blue-600 mt-1">
                            <div className="font-medium">Enhanced prompt:</div>
                            <div className="italic">"{t.enhancedPrompt}"</div>
                          </div>
                        )}
                        <div className={`text-sm ${
                          isSuccess ? "text-green-600" : 
                          isFailed ? "text-red-600" : 
                          isProcessing ? "text-blue-600" : 
                          isQueued ? "text-yellow-600" :
                          "text-muted-foreground"
                        }`}>
                          Status: {isQueued ? "In wachtrij" : t.status}
                          {isQueued && <span className="ml-2">⏳</span>}
                          {isProcessing && <span className="ml-2">🔄</span>}
                          {isSuccess && <span className="ml-2">✅</span>}
                          {isFailed && <span className="ml-2">❌</span>}
                        </div>
                        {isQueued && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Maximaal 3 video's tegelijkertijd. Jouw video wordt verwerkt zodra er ruimte is.
                          </div>
                        )}
                        {t.error && <div className="text-red-600 text-xs mt-1">{t.error}</div>}
                      </div>
                      {t.url ? (
                        <a 
                          className="text-sm underline text-blue-600 hover:text-blue-800" 
                          href={t.url} 
                          target="_blank" 
                          rel="noreferrer"
                        >
                          Download
                        </a>
                      ) : null}
                    </div>
                    {t.url ? (
                      <video src={t.url} controls className="mt-3 w-full rounded" />
                    ) : isProcessing ? (
                      <div className="mt-3 p-4 bg-muted/30 rounded text-center text-sm text-muted-foreground">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mx-auto mb-2"></div>
                        Video wordt gegenereerd...
                      </div>
                    ) : isQueued ? (
                      <div className="mt-3 p-4 bg-yellow-50 rounded text-center text-sm text-yellow-700">
                        <div className="animate-pulse">⏳</div>
                        Wachtend in wachtrij...
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })}
          </div>
          
          {/* Combined Video Section */}
          {combinedVideo && (
            <div className="mt-8 p-6 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border-2 border-purple-200">
              <h3 className="text-lg font-semibold text-purple-800 mb-4 flex items-center gap-2">
                🎬 Gecombineerde Video
                {combinedVideo.status === "processing" && <span className="animate-spin">⏳</span>}
                {combinedVideo.status === "succeed" && <span>✅</span>}
                {combinedVideo.status === "failed" && <span>❌</span>}
              </h3>
              
              {combinedVideo.status === "processing" && (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
                  <p className="text-purple-700">Videos worden gecombineerd tot één geheel...</p>
                </div>
              )}
              
              {combinedVideo.status === "succeed" && combinedVideo.url && (
                <div>
                  <p className="text-green-700 mb-4">✅ Alle videos zijn succesvol gecombineerd!</p>
                  <video 
                    src={combinedVideo.url} 
                    controls 
                    className="w-full rounded-lg shadow-lg"
                    style={{ maxHeight: '400px' }}
                  />
                  <div className="mt-4 flex gap-2">
                    <a 
                      href={combinedVideo.url}
                      download={`combined-video-${sessionId}.mp4`}
                      className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                    >
                      Download Gecombineerde Video
                    </a>
                  </div>
                </div>
              )}
              
              {combinedVideo.status === "failed" && (
                <div className="text-red-700">
                  <p>❌ Fout bij het combineren van videos:</p>
                  <p className="text-sm mt-2 p-3 bg-red-50 rounded border">
                    {combinedVideo.error || "Onbekende fout"}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

