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
  const [isGenerating, setIsGenerating] = useState(false);
  const [duration, setDuration] = useState("5");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [transitionPrompts, setTransitionPrompts] = useState<{ [key: string]: string }>({});
  
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
  const [submissionStatus, setSubmissionStatus] = useState<'idle' | 'submitting' | 'submitted' | 'error'>('idle');
  const [queueInfo, setQueueInfo] = useState<{
    position: number;
    totalInQueue: number;
    estimatedWaitMinutes: number;
    estimatedCompletionTime: string;
  } | null>(null);








  const handleGenerate = async () => {
    // Show modal for code validation and email input
    setShowEmailModal(true);
  };

  const handleModalSubmit = async () => {
    // Validate code first
    if (!code.trim()) {
      alert('Please enter a code first');
      return;
    }

    setIsValidatingCode(true);
    setSubmissionStatus('submitting');

    try {
      // Validate the code
      const codeResponse = await fetch('/api/codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() })
      });
      
      const codeResult = await codeResponse.json();
      setCodeValidation(codeResult);
      
      if (!codeResult.valid) {
        alert(codeResult.error || 'Invalid code');
        setSubmissionStatus('error');
        return;
      }

    const candidates = frames.filter((f) => f.image);
      if (candidates.length < 2) {
        alert('Please upload at least 2 images');
        setSubmissionStatus('error');
        return;
      }

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
          setSubmissionStatus('error');
        return;
      }
    }

      // Upload images to storage first to avoid large request body
      console.log('📤 [STORY] Uploading images to storage...');
      const uploadedFramePairs = await Promise.all(
        framePairs.map(async ([frame, nextFrame]) => {
          // Upload both images to storage
          const fromImageResponse = await fetch('/api/images/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              imageBase64: frame.imageBase64,
              filename: `frame-${frame.id}-${Date.now()}.jpg`
            })
          });
          
          const toImageResponse = await fetch('/api/images/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              imageBase64: nextFrame.imageBase64,
              filename: `frame-${nextFrame.id}-${Date.now()}.jpg`
            })
          });
          
          if (!fromImageResponse.ok || !toImageResponse.ok) {
            throw new Error('Failed to upload images to storage');
          }
          
          const fromImageData = await fromImageResponse.json();
          const toImageData = await toImageResponse.json();
          
          return [
            { ...frame, imageUrl: fromImageData.url },
            { ...nextFrame, imageUrl: toImageData.url }
          ];
        })
      );

      // Submit to server-side batch processing with image URLs instead of base64
      const response = await fetch('/api/queue/submit-batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: `session-${Date.now()}`,
          framePairs: uploadedFramePairs,
          transitionPrompts,
          duration: parseInt(duration),
          aspectRatio,
          code: code.trim(),
          email: email || undefined
        })
      });

      if (!response.ok) {
        throw new Error('Failed to submit video generation request');
      }

      const result = await response.json();
      
      // Store queue information if available
      if (result.queueInfo) {
        setQueueInfo(result.queueInfo);
      }
      
      setSubmissionStatus('submitted');
      setShowEmailModal(false);
      setShowResultScreen(true);

    } catch (error) {
      console.error('Generation error:', error);
      setSubmissionStatus('error');
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsValidatingCode(false);
    }
  };

  const validateCode = async (code: string) => {
    setIsValidatingCode(true);
    try {
      const response = await fetch('/api/codes/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      });
      
            const result = await response.json();
      setCodeValidation(result);
      return result.valid;
    } catch (error) {
      console.error('Code validation error:', error);
      setCodeValidation({ valid: false });
      return false;
    } finally {
      setIsValidatingCode(false);
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


  const uploadedCount = frames.filter(f => f.image).length;

  // Memoized handler for textarea changes to prevent unnecessary re-renders
  const handleTransitionPromptChange = useCallback((frameId: string, nextFrameId: string, value: string) => {
    const transitionKey = `${frameId}-${nextFrameId}`;
    setTransitionPrompts(prev => ({
      ...prev,
      [transitionKey]: value
    }));
  }, []);


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
          
          </>
        )}

        {/* Code Validation and Email Modal */}
        {showEmailModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-lg w-full p-6 shadow-xl">
              <div className="text-center mb-6">
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">
                  Generate Your Video
              </h2>
                <p className="text-gray-600">
                  Enter your access code and email to start video generation
                </p>
              </div>
              
              <div className="space-y-4">
                {/* Code Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Access Code
                  </label>
                  <div className="flex gap-2">
                    <Input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="Enter your access code"
                      className="flex-1"
                    />
                    <Button
                      onClick={() => validateCode(code)}
                      disabled={!code.trim() || isValidatingCode}
                      variant="outline"
                    >
                      {isValidatingCode ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        'Validate'
                      )}
                    </Button>
                  </div>
                  {codeValidation && (
                    <div className="mt-2 flex items-center gap-2">
                      {codeValidation.valid ? (
                        <>
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-sm text-green-600">
                            Valid {codeValidation.packageType} code
                          </span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-4 h-4 text-red-500" />
                          <span className="text-sm text-red-600">
                            Invalid code
                      </span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Email Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address (Optional)
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    We'll notify you when your video is ready
                  </p>
                </div>

                {/* Submission Status */}
                {submissionStatus !== 'idle' && (
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    {submissionStatus === 'submitting' && (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                        <span className="text-blue-600">Submitting your video request...</span>
                      </>
                    )}
                    {submissionStatus === 'submitted' && (
                      <>
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        <span className="text-green-600">
                          Video request submitted! {email ? 'Check your email for updates.' : 'Your video will be processed on our servers.'}
                        </span>
                      </>
                    )}
                    {submissionStatus === 'error' && (
                      <>
                        <XCircle className="w-5 h-5 text-red-500" />
                        <span className="text-red-600">Error submitting request. Please try again.</span>
                      </>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={handleModalSubmit}
                    disabled={!code.trim() || isValidatingCode || submissionStatus === 'submitting'}
                    className="flex-1"
                  >
                    {submissionStatus === 'submitting' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                        Submitting...
                      </>
                    ) : (
                      'Generate Video'
                    )}
                  </Button>
                  <Button
                    onClick={() => setShowEmailModal(false)}
                    variant="outline"
                    disabled={submissionStatus === 'submitting'}
                  >
                    Cancel
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
                  Video Generation Started! 🎬
                </h2>
                
                <p className="text-gray-600 mb-6">
                  Your video is being generated on our servers. {email ? `You'll receive an email at ${email} when it's ready.` : 'Your video will be processed in the background.'}
                </p>

                {/* Queue Information */}
                {queueInfo && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-center mb-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                        <span className="text-blue-600 font-bold text-sm">#</span>
                      </div>
                      <div className="text-center">
                        <p className="text-blue-800 font-semibold">
                          Position #{queueInfo.position} in queue
                        </p>
                        <p className="text-blue-600 text-sm">
                          {queueInfo.totalInQueue} videos ahead of you
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-center space-y-2">
                      <p className="text-blue-700 font-medium">
                        ⏱️ Estimated wait time: {queueInfo.estimatedWaitMinutes} minutes
                      </p>
                      <p className="text-blue-600 text-sm">
                        Expected completion: {new Date(queueInfo.estimatedCompletionTime).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="space-y-4">
                  <Button
                    onClick={() => {
                      setShowResultScreen(false);
                      setEmailSent(false);
                      setDownloadLink('');
                      setEmail('');
                      setSubmissionStatus('idle');
                      setQueueInfo(null);
                      // Reset the entire state for a new video
                      setFrames([
                        { id: '1' },
                        { id: '2' },
                        { id: '3' },
                        { id: '4' }
                      ]);
                      setTransitionPrompts({});
                      setCode('');
                      setCodeValidation(null);
                    }}
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