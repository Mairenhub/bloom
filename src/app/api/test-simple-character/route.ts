import { NextRequest } from "next/server";
import { enhancePromptForKlingAI } from "@/lib/openai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, videoIndex = 0 } = body;
    
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    console.log("🧪 [TEST SIMPLE CHARACTER] Testing prompt enhancement:", prompt);
    
    // Test prompt enhancement
    const enhanced = await enhancePromptForKlingAI(prompt);
    
    return new Response(JSON.stringify({
      originalPrompt: prompt,
      videoIndex,
      enhancedPrompt: enhanced.enhancedPrompt,
      reasoning: enhanced.reasoning,
      summary: {
        originalLength: prompt.length,
        enhancedLength: enhanced.enhancedPrompt.length,
        enhancementRatio: (enhanced.enhancedPrompt.length / prompt.length).toFixed(2)
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error: unknown) {
    console.error("💥 [TEST SIMPLE CHARACTER] Error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Failed to test character detection" 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const prompt = searchParams.get('prompt') || "guy walks away";
    const videoIndex = parseInt(searchParams.get('videoIndex') || '0');
    
    console.log("🧪 [TEST SIMPLE CHARACTER] Testing with prompt:", prompt);
    
    // Test prompt enhancement
    const enhanced = await enhancePromptForKlingAI(prompt);
    
    return new Response(JSON.stringify({
      originalPrompt: prompt,
      videoIndex,
      enhancedPrompt: enhanced.enhancedPrompt,
      reasoning: enhanced.reasoning,
      summary: {
        originalLength: prompt.length,
        enhancedLength: enhanced.enhancedPrompt.length,
        enhancementRatio: (enhanced.enhancedPrompt.length / prompt.length).toFixed(2)
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error: unknown) {
    console.error("💥 [TEST SIMPLE CHARACTER] Error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Failed to test character detection" 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
