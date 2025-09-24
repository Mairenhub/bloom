import { NextRequest } from "next/server";
import { enhancePromptForKlingAI, enhancePromptWithAdvancedTraining } from "@/lib/openai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt } = body;
    
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    console.log("🧪 [TEST PROMPT] Testing prompt enhancement:", prompt);
    
    // Test both methods
    const aiEnhanced = await enhancePromptForKlingAI(prompt);
    const advancedEnhanced = enhancePromptWithAdvancedTraining(prompt);
    
    return new Response(JSON.stringify({
      originalPrompt: prompt,
      aiEnhanced: {
        prompt: aiEnhanced.enhancedPrompt,
        reasoning: aiEnhanced.reasoning
      },
      advancedEnhanced: {
        prompt: advancedEnhanced,
        reasoning: "Advanced pattern matching applied"
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error: any) {
    console.error("💥 [TEST PROMPT] Error:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Failed to test prompt enhancement" 
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
    
    console.log("🧪 [TEST PROMPT] Testing with prompt:", prompt);
    
    const aiEnhanced = await enhancePromptForKlingAI(prompt);
    const advancedEnhanced = enhancePromptWithAdvancedTraining(prompt);
    
    return new Response(JSON.stringify({
      originalPrompt: prompt,
      aiEnhanced: {
        prompt: aiEnhanced.enhancedPrompt,
        reasoning: aiEnhanced.reasoning
      },
      advancedEnhanced: {
        prompt: advancedEnhanced,
        reasoning: "Advanced pattern matching applied"
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error: any) {
    console.error("💥 [TEST PROMPT] Error:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Failed to test prompt enhancement" 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
