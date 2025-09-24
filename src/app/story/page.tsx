"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import { Plus, ArrowLeftRight, Upload, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import Image from "next/image";
import { Textarea } from "@/components/ui/textarea";

type Frame = {
  id: string;
  image?: string; // data URL for display
  imageBase64?: string; // base64 string for API
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
      { id: "2" }
    ],
    []
  );
}

export default function StoryboardPage() {
  const [frames, setFrames] = useState<Frame[]>(useInitialFrames());
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCombining, setIsCombining] = useState(false);
  const [combinedVideo, setCombinedVideo] = useState<CombinedVideo | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [duration, setDuration] = useState("5");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [transitionPrompts, setTransitionPrompts] = useState<{ [key: string]: string }>({});
  const pollers = useRef<{ [key: string]: NodeJS.Timeout }>({});
  
  // Code redemption state
  const [code, setCode] = useState('');
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [codeValidation, setCodeValidation] = useState<{
    valid: boolean;
    packageType?: string;
    error?: string;
  } | null>(null);
  
  // Email and result state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [email, setEmail] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [downloadLink, setDownloadLink] = useState('');
  const [showResultScreen, setShowResultScreen] = useState(false);



  const updateVideoInDatabase = async (taskId: string, status: string, videoUrl?: string, errorMessage?: string) => {
    try {
      const response = await fetch(`/api/videos/${encodeURIComponent(taskId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          status,
          videoUrl,
          errorMessage
        })
      });
      
      if (!response.ok) {
        console.error("❌ [UI DEBUG] Error updating video:", await response.text());
      }
    } catch (error) {
      console.error("❌ [UI DEBUG] Error updating video:", error);
    }
  };

  const pollTask = async (task: TaskInfo) => {
    // Don't poll failed tasks
    if (task.status === "failed") return;
    
    try {
      let status: TaskInfo["status"] = task.status;
      let url: string | undefined = task.url;
      
      if (task.status === "queued") {
        // For queued tasks, check the video database for updated status
        const videoRes = await fetch(`/api/videos/${encodeURIComponent(task.taskId)}`);
        if (videoRes.ok) {
          const videoData = await videoRes.json();
          const videoStatus = videoData.video?.status;
          const videoUrl = videoData.video?.video_url;
          
          if (videoStatus && videoStatus !== task.status) {
            status = videoStatus;
            url = videoUrl;
            
            // If the task has been processed and now has a KlingAI task ID, update the task ID
            if (videoStatus === 'submitted' || videoStatus === 'processing') {
              const klingTaskId = videoData.video?.task_id;
              if (klingTaskId && klingTaskId !== task.taskId) {
                console.log("🔄 [POLL DEBUG] Task moved from queue to KlingAI:", task.taskId, "->", klingTaskId);
                // Update the task ID in the local state
                setTasks(prev => prev.map(t => 
                  t.taskId === task.taskId ? { ...t, taskId: klingTaskId, status: videoStatus, url: videoUrl } : t
                ));
                return; // Exit early since we've updated the task
              }
            }
          }
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
      
      // Update local state only if there's actually a change
      setTasks((prev) => {
        const currentTask = prev.find(t => t.taskId === task.taskId);
        if (currentTask && (currentTask.status !== status || currentTask.url !== url)) {
          return prev.map((t) => (t.taskId === task.taskId ? { ...t, status, url } : t));
        }
        return prev;
      });
      
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
        
        // Trigger queue processing to start next queued task
        try {
          const queueResponse = await fetch('/api/queue/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          
          if (queueResponse.ok) {
            const queueResult = await queueResponse.json();
            console.log("🔄 [POLL DEBUG] Queue processing triggered after task completion:", queueResult);
          }
        } catch (queueError) {
          console.error("❌ [POLL DEBUG] Error triggering queue processing after completion:", queueError);
        }
        
        // Check if all videos are complete and trigger combination
        await checkAndCombineVideos();
      }
    } catch (error) {
      console.error("Error polling task:", error);
      const errorMessage = "Polling failed";
      
      // Update local state only if there's actually a change
      setTasks((prev) => {
        const currentTask = prev.find(t => t.taskId === task.taskId);
        if (currentTask && currentTask.status !== "failed") {
          return prev.map((t) => (t.taskId === task.taskId ? { ...t, status: "failed", error: errorMessage } : t));
        }
        return prev;
      });
      
      // Update database
      await updateVideoInDatabase(task.taskId, "failed", undefined, errorMessage);
      
      if (pollers.current[task.taskId]) {
        clearInterval(pollers.current[task.taskId]);
        delete pollers.current[task.taskId];
      }
      
      // Trigger queue processing to start next queued task
      try {
        const queueResponse = await fetch('/api/queue/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (queueResponse.ok) {
          const queueResult = await queueResponse.json();
          console.log("🔄 [POLL DEBUG] Queue processing triggered after task failure:", queueResult);
        }
      } catch (queueError) {
        console.error("❌ [POLL DEBUG] Error triggering queue processing after failure:", queueError);
      }
      
      // Check if all videos are complete and trigger combination
      await checkAndCombineVideos();
    }
  };

  const downloadAndStoreVideo = async (taskId: string, videoUrl: string) => {
    try {
      console.log("📥 [UI DEBUG] Downloading video:", videoUrl);
      
      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error("Failed to download video");
      
      const blob = await response.blob();
      const file = new File([blob], `${taskId}.mp4`, { type: 'video/mp4' });
      
      // Upload to Supabase storage
      const formData = new FormData();
      formData.append('file', file);
      formData.append('taskId', taskId);
      
      const uploadResponse = await fetch('/api/videos/upload', {
        method: 'POST',
        body: formData
      });
      
      if (uploadResponse.ok) {
        const uploadData = await uploadResponse.json();
        console.log("✅ [UI DEBUG] Video uploaded:", uploadData);
        
        // Update the task with the new URL
        setTasks(prev => prev.map(t => 
          t.taskId === taskId ? { ...t, url: uploadData.url } : t
        ));
        
        // Update database with new URL
        await updateVideoInDatabase(taskId, "succeed", uploadData.url);
      }
    } catch (error) {
      console.error("❌ [UI DEBUG] Error downloading/storing video:", error);
    }
  };

  const checkAndCombineVideos = async () => {
    const allTasks = tasks.filter(t => t.frameId !== 'combined');
    const completedTasks = allTasks.filter(t => t.status === "succeed");
    
    console.log("🔍 [UI DEBUG] Checking combination:", {
      total: allTasks.length,
      completed: completedTasks.length
    });
    
    if (allTasks.length > 0 && allTasks.length === completedTasks.length) {
      console.log("🎬 [UI DEBUG] All videos complete, starting combination");
      await combineVideos();
    }
  };

  const combineVideos = async () => {
    setIsCombining(true);
    
    try {
      const videoUrls = tasks
        .filter(t => t.status === "succeed" && t.url)
        .sort((a, b) => {
          const aIndex = parseInt(a.frameId);
          const bIndex = parseInt(b.frameId);
          return aIndex - bIndex;
        })
        .map(t => t.url!);
      
      console.log("🎬 [UI DEBUG] Combining videos:", videoUrls);
      
      const response = await fetch('/api/videos/combine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoUrls,
          sessionId: sessionId || 'default',
          duration: parseInt(duration),
          aspectRatio
        })
      });
      
      if (!response.ok) {
        throw new Error("Failed to combine videos");
      }
      
      const result = await response.json();
      console.log("✅ [UI DEBUG] Combination result:", result);
      
      setCombinedVideo({
        id: result.taskId,
        url: result.url,
        status: result.status
      });
      
      // Add combined video as a task
      setTasks(prev => [...prev, {
        frameId: 'combined',
        taskId: result.taskId,
        status: result.status,
        url: result.url
      }]);

      // Show email modal for download link
      if (result.status === 'succeed' && result.url) {
        setDownloadLink(result.url);
        setShowEmailModal(true);
      }
      
    } catch (error) {
      console.error("❌ [UI DEBUG] Error combining videos:", error);
      setCombinedVideo({
        id: 'error',
        url: '',
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsCombining(false);
    }
  };

  const handleGenerate = async () => {
    // First validate the code if not already validated
    if (!codeValidation?.valid) {
      if (!code.trim()) {
        alert('Please enter a code first');
        return;
      }
      
      // Validate the code
      setIsValidatingCode(true);
      try {
        const response = await fetch('/api/codes/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: code.trim() })
        });
        
        const data = await response.json();
        setCodeValidation(data);
        
        if (!data.valid) {
          alert(data.error || 'Invalid code');
          setIsValidatingCode(false);
          return;
        }
      } catch (error) {
        console.error('Error validating code:', error);
        alert('Failed to validate code');
        setIsValidatingCode(false);
        return;
      } finally {
        setIsValidatingCode(false);
      }
    }

    if (!window.confirm("Ben je zeker? Dit zal de beelden naar KlingAI sturen.")) return;
    const candidates = frames.filter((f) => f.image);
    if (candidates.length < 2) return;

    // Validate that all transitions have prompts
    const framePairs = [];
    for (let i = 0; i < candidates.length - 1; i++) {
      framePairs.push([candidates[i], candidates[i + 1]]);
    }

    for (const [frame, nextFrame] of framePairs) {
      const transitionKey = `${frame.id}-${nextFrame.id}`;
      const prompt = transitionPrompts[transitionKey];
      if (!prompt || prompt.trim().length < 10) {
        alert(`Please enter a detailed prompt for the transition from Frame ${frame.id} to Frame ${nextFrame.id}`);
        return;
      }
    }

    setIsGenerating(true);
    // Don't clear previous tasks - they're now persisted in database

    try {
      // Redeem the code first
      const redeemResponse = await fetch('/api/codes/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() })
      });
      
      if (!redeemResponse.ok) {
        throw new Error('Failed to redeem code');
      }
      
      const redeemedData = await redeemResponse.json();
      console.log('Code redeemed:', redeemedData);

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
      const transitions = framePairs.map(([frame, nextFrame]) => {
        const transitionKey = `${frame.id}-${nextFrame.id}`;
        return {
          fromFrameId: frame.id,
          toFrameId: nextFrame.id,
          userInput: transitionPrompts[transitionKey] || "Create a smooth transition from this image to the next"
        };
      });

      console.log("🤖 [UI DEBUG] Generating batch prompts for transitions:", transitions.length);
      
      const promptResponse = await fetch('/api/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch',
          transitions
        })
      });

      if (!promptResponse.ok) {
        throw new Error('Failed to generate prompts');
      }

        const promptData = await promptResponse.json();
      console.log("✅ [UI DEBUG] Generated prompts:", promptData);

      // Create tasks for each frame pair
      const newTasks: TaskInfo[] = [];
      
      for (let i = 0; i < framePairs.length; i++) {
        const [frame, nextFrame] = framePairs[i];
        const taskId = `sb-${frame.id}-${Date.now()}-${i}`;
        
        // Find the enhanced prompt for this transition
        const enhancedTransition = promptData.transitions.find((t: { fromFrameId: string; toFrameId: string }) => 
          t.fromFrameId === frame.id && t.toFrameId === nextFrame.id
        );
        
        const taskData = {
          frameId: frame.id,
          sessionId: newSessionId,
          image: frame.imageBase64, // Use base64 string for API
          imageTail: nextFrame.imageBase64, // Use base64 string for API
          prompt: enhancedTransition?.enhancedPrompt || `Create a smooth transition from this image to the next`,
          negativePrompt: "no face swap, no different actor, no hairstyle change, no different clothes, no mask, no occlusion of face, no heavy motion blur",
          mode: "pro",
          duration: duration || "5",
          aspectRatio: aspectRatio || "16:9",
          videoIndex: i,
          totalVideos: framePairs.length,
          packageType: redeemedData.packageType
        };

        try {
          const response = await fetch('/api/queue/process-or-queue', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId,
              sessionId: newSessionId,
              frameId: frame.id,
              priority: 0,
              taskData,
              accountId: 'default'
            })
          });

          if (response.ok) {
            const result = await response.json();
            const newTask: TaskInfo = {
              frameId: frame.id,
              taskId: result.taskId,
              status: result.processed ? 'submitted' : 'queued',
              originalPrompt: taskData.prompt,
              enhancedPrompt: enhancedTransition?.enhancedPrompt,
              videoIndex: i,
              totalVideos: framePairs.length,
            };
            
            newTasks.push(newTask);
            
            // Start polling for this task
            if (result.processed) {
              pollers.current[result.taskId] = setInterval(() => {
                pollTask(newTask);
              }, 10000); // Increased to 10 seconds to reduce polling frequency
            }
        } else {
            console.error('Failed to create task for frame:', frame.id);
          }
        } catch (error) {
          console.error('Error creating task:', error);
        }
      }
      
      setTasks(prev => [...prev, ...newTasks]);
      console.log("✅ [UI DEBUG] Created tasks:", newTasks);
      
      // Trigger queue processing for any queued tasks
      try {
        const queueResponse = await fetch('/api/queue/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        if (queueResponse.ok) {
          const queueResult = await queueResponse.json();
          console.log("🔄 [UI DEBUG] Initial queue processing triggered:", queueResult);
          
          // Check if any tasks were processed from the queue
          if (queueResult.processedCount > 0) {
            console.log("✅ [UI DEBUG] Queue processed tasks:", queueResult.processedCount);
          }
        }
      } catch (queueError) {
        console.error("❌ [UI DEBUG] Error triggering initial queue processing:", queueError);
      }
      
    } catch (error) {
      console.error('Error generating videos:', error);
      alert('Failed to generate videos. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImageUpload = (frameId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      // Extract base64 string from data URL
      const base64String = dataUrl.split(',')[1];
      setFrames(prev => prev.map(f => 
        f.id === frameId ? { 
          ...f, 
          image: dataUrl, // for display with Next.js Image
          imageBase64: base64String // for API calls
        } : f
      ));
    };
    reader.readAsDataURL(file);
  };

  const addFrame = () => {
    if (frames.length >= 5) return;
    const newId = (Math.max(...frames.map(f => parseInt(f.id))) + 1).toString();
    setFrames(prev => [...prev, { id: newId }]);
  };

  const removeFrame = (frameId: string) => {
    if (frames.length <= 2) return;
    
    // Clean up transition prompts for the removed frame
    setTransitionPrompts(prev => {
      const newPrompts = { ...prev };
      // Remove prompts that involve the deleted frame
      Object.keys(newPrompts).forEach(key => {
        if (key.includes(frameId)) {
          delete newPrompts[key];
        }
      });
      return newPrompts;
    });
    
    setFrames(prev => prev.filter(f => f.id !== frameId));
  };

  const moveFrame = (frameId: string, direction: 'left' | 'right') => {
    const currentIndex = frames.findIndex(f => f.id === frameId);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= frames.length) return;
    
    const newFrames = [...frames];
    [newFrames[currentIndex], newFrames[newIndex]] = [newFrames[newIndex], newFrames[currentIndex]];
    setFrames(newFrames);
    
    // Clear transition prompts when frames are reordered since the relationships change
    setTransitionPrompts({});
  };

  const getStatusIcon = (status: TaskInfo['status']) => {
    switch (status) {
      case 'succeed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'processing':
      case 'submitted':
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <div className="w-5 h-5 bg-gray-300 rounded-full" />;
    }
  };

  const uploadedCount = frames.filter(f => f.image).length;

  // Memoized handler for textarea changes to prevent unnecessary re-renders
  const handleTransitionPromptChange = useCallback((frameId: string, nextFrameId: string, value: string) => {
    const transitionKey = `${frameId}-${nextFrameId}`;
    setTransitionPrompts(prev => ({
      ...prev,
      [transitionKey]: value
    }));
  }, []);

  // Email sending function for notifications
  const sendEmailNotification = async (emailAddress: string) => {
    setIsSendingEmail(true);
    try {
      const response = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailAddress,
          downloadUrl: downloadLink,
          sessionId: sessionId,
          type: 'notification'
        })
      });

      if (response.ok) {
        setEmailSent(true);
        alert('Email notification sent! You will be notified when your video is ready.');
      } else {
        throw new Error('Failed to send email');
      }
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Failed to send email. Please try again.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Create Your AI Video
          </h1>
          <p className="text-lg text-gray-600">
            Upload your photos and enter your code to generate a beautiful video
          </p>
      </div>



        {/* Main Content - Hidden when success screen is shown */}
        {!showEmailModal && !showResultScreen && (
          <>
            {/* Storyboard */}
            <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Storyboard ({uploadedCount}/{frames.length} photos uploaded)
            </h2>
              <div className="flex gap-2">
                <Button 
                  onClick={addFrame}
                  variant="outline" 
                  size="sm"
                  disabled={frames.length >= 5}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add Frame ({frames.length}/5)
                </Button>
              </div>
            </div>

            <ScrollArea className="w-full" style={{ willChange: 'transform' }}>
              <div className="flex gap-4 pb-4">
                {frames.map((frame, index) => (
                  <div key={frame.id} className="flex items-center gap-4">
                   


                    <div className="flex-shrink-0">
                      <div className="w-64 h-128 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-gray-400 transition-colors">
                        {frame.image ? (
                          <Image
                            src={frame.image}
                            alt={`Frame ${frame.id}`}
                            width={128}
                            height={128}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <label className="cursor-pointer flex flex-col items-center justify-center w-full h-full">
                            <Upload className="w-8 h-8 text-gray-400 mb-2" />
                            <span className="text-xs text-gray-500">Upload</span>
                            <Input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImageUpload(frame.id, file);
                              }}
                            />
                          </label>
                        )}
                          </div>
                      <div className="text-center mt-2">
                        {frames.length > 2 && (
                          <Button
                            onClick={() => removeFrame(frame.id)}
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700"
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>


                    {index < frames.length - 1 && (
                      <div className="flex-shrink-0 w-80 flex items-center gap-2">
                        <div className="flex-col items-center">
                         <Button
                        onClick={() => moveFrame(frame.id, 'left')}
                        variant="outline"
                        size="sm"
                        className="p-2 rounded-full"
                          >
                            <ArrowLeftRight className="w-4 h-4" />
                          </Button> 
                        <div className="bg-gray-50 p-4 rounded-lg border">

                     
                          <Textarea
                            id={`prompt-${frame.id}-${frames[index + 1].id}`}
                            value={transitionPrompts[`${frame.id}-${frames[index + 1].id}`] || ""}
                            onChange={(e) => handleTransitionPromptChange(frame.id, frames[index + 1].id, e.target.value)}
                            placeholder="e.g., 'The person walks from left to right, changing from casual clothes to formal wear'"
                            className="w-full h-20 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm"
                            disabled={isGenerating}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Describe the movement between these frames
                          </p>
                        </div>
                        </div>
                      </div>
                    )}

                      </div>
                ))}
                      </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
                  </CardContent>
                </Card>



        {/* Code Input and Generate Button */}
        <div className="text-center mb-8">
          <div className="max-w-md mx-auto mb-6">
            <Input
              type="text"
              placeholder="Enter your code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              className="text-center font-mono text-lg mb-4"
              disabled={isGenerating}
            />
            
            {codeValidation?.valid && (
              <div className="p-3 rounded-lg mb-4 bg-green-100 text-green-800">
                <div className="flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 mr-2" />
                  <span>Valid code! Package: {codeValidation.packageType}</span>
                </div>
              </div>
            )}
          </div>
          
          <Button
            onClick={handleGenerate}
            disabled={!code.trim() || uploadedCount < 2 || isGenerating}
            size="lg"
            className="px-12 py-4 text-lg"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Creating Video...
              </>
            ) : isValidatingCode ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Validating Code...
              </>
            ) : (
              <>
                Generate Video
              </>
            )}
          </Button>
        </div>
          
        {/* Task Status */}
        {tasks.length > 0 && (
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Video Generation Status
              </h2>
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div key={task.taskId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(task.status)}
                      <span className="font-medium">
                        {task.frameId === 'combined' ? 'Final Video' : `Frame ${task.frameId}`}
                      </span>
                      <span className="text-sm text-gray-500 capitalize">{task.status}</span>
                </div>
                    {task.url && (
                      <a
                        href={task.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        Download
                      </a>
                    )}
                  </div>
                ))}
                </div>
            </CardContent>
          </Card>
          )}
          </>
        )}

        {/* Success Screen with Download Link */}
        {showEmailModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-lg w-full p-6 shadow-xl">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  🎬 Your Video is Ready!
                </h2>
                
                <p className="text-gray-600 mb-6">
                  Your AI-generated video has been successfully created and is ready for download.
                </p>
                
                <div className="space-y-4">
                  <a
                    href={downloadLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-semibold"
                  >
                    Download Video Now
                  </a>
                  
                  <div className="border-t pt-4">
                    <p className="text-sm text-gray-600 mb-4">
                      Want to be notified about future video updates? Enter your email:
                    </p>
                    
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="Enter your email address"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="flex-1"
                        disabled={isSendingEmail}
                      />
                      <Button
                        onClick={() => sendEmailNotification(email)}
                        disabled={!email.trim() || isSendingEmail}
                        variant="outline"
                      >
                        {isSendingEmail ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          "Notify Me"
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <Button
                    onClick={() => {
                      setShowEmailModal(false);
                      setShowResultScreen(true);
                    }}
                    variant="ghost"
                    className="w-full"
                  >
                    Continue Without Email
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Result Screen */}
        {showResultScreen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-lg w-full p-6 shadow-xl">
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                
                <h2 className="text-2xl font-semibold text-gray-900 mb-4">
                  Video Ready! 🎬
                </h2>
                
                <p className="text-gray-600 mb-6">
                  {emailSent 
                    ? `Download link sent to ${email}` 
                    : 'Your combined video is ready for download'
                  }
                </p>
                
                <div className="space-y-4">
                  <a
                    href={downloadLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Download Video
                  </a>
                  
                  <Button
                    onClick={() => {
                      setShowResultScreen(false);
                      setEmailSent(false);
                      setDownloadLink('');
                      setEmail('');
                      // Reset the entire state for a new video
                      setFrames([
                        { id: '1', image: undefined },
                        { id: '2', image: undefined },
                        { id: '3', image: undefined },
                        { id: '4', image: undefined }
                      ]);
                      setTasks([]);
                      setCombinedVideo(null);
                      setTransitionPrompts({});
                      setCode('');
                      setCodeValidation(null);
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Create Another Video
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}