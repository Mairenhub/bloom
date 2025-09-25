import { NextRequest } from "next/server";
import { enhancePromptForKlingAI, generateBatchPrompts, type TransitionPrompt } from "@/lib/openai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, action = "enhance", transitions } = body;
    
    console.log("🤖 [PROMPT API] Processing request:", { action, prompt, transitionsCount: transitions?.length });
    
    // Handle batch processing for transitions
    if (action === "batch" && transitions && Array.isArray(transitions)) {
      const transitionPrompts: TransitionPrompt[] = transitions.map((t: any) => ({
        fromFrameId: t.fromFrameId,
        toFrameId: t.toFrameId,
        userInput: t.userInput || ""
      }));
      
      const result = await generateBatchPrompts(transitionPrompts);
      
      console.log("✅ [PROMPT API] Batch result:", result);
      
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    // Handle single prompt enhancement (legacy)
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    let result;
    
    if (action === "enhance") {
      result = await enhancePromptForKlingAI(prompt);
    } else {
      return new Response(JSON.stringify({ error: "Invalid action. Use 'enhance' or 'batch'" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log("✅ [PROMPT API] Result:", result);
    
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error("💥 [PROMPT API] Error:", error);
    return new Response(JSON.stringify({ 
      error: "Failed to process prompt",
      details: error instanceof Error ? error.message : "Unknown error"
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
