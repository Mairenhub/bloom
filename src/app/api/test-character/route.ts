import { NextRequest } from "next/server";
import { analyzeCharacterAndGenerateIdentity, generateKlingAIParams } from "@/lib/openai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, videoIndex = 0, totalVideos = 3 } = body;
    
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Prompt is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }
    
    console.log("🧪 [TEST CHARACTER] Testing character analysis:", prompt);
    
    // Step 1: Analyze character and generate identity
    const characterIdentity = await analyzeCharacterAndGenerateIdentity(prompt, videoIndex === 0);
    
    // Step 2: Generate KlingAI parameters for this video
    const klingAIParams = await generateKlingAIParams(prompt, characterIdentity, videoIndex, totalVideos);
    
    return new Response(JSON.stringify({
      originalPrompt: prompt,
      videoIndex,
      totalVideos,
      characterIdentity,
      klingAIParams,
      summary: {
        characterName: characterIdentity.characterName,
        idCard: characterIdentity.idCard,
        enhancedPrompt: klingAIParams.prompt,
        modelSettings: {
          model: klingAIParams.modelName,
          mode: klingAIParams.mode,
          duration: klingAIParams.duration,
          aspectRatio: klingAIParams.aspectRatio
        }
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error: any) {
    console.error("💥 [TEST CHARACTER] Error:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Failed to test character analysis" 
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
    const totalVideos = parseInt(searchParams.get('totalVideos') || '3');
    
    console.log("🧪 [TEST CHARACTER] Testing with prompt:", prompt);
    
    // Step 1: Analyze character and generate identity
    const characterIdentity = await analyzeCharacterAndGenerateIdentity(prompt, videoIndex === 0);
    
    // Step 2: Generate KlingAI parameters for this video
    const klingAIParams = await generateKlingAIParams(prompt, characterIdentity, videoIndex, totalVideos);
    
    return new Response(JSON.stringify({
      originalPrompt: prompt,
      videoIndex,
      totalVideos,
      characterIdentity,
      klingAIParams,
      summary: {
        characterName: characterIdentity.characterName,
        idCard: characterIdentity.idCard,
        enhancedPrompt: klingAIParams.prompt,
        modelSettings: {
          model: klingAIParams.modelName,
          mode: klingAIParams.mode,
          duration: klingAIParams.duration,
          aspectRatio: klingAIParams.aspectRatio
        }
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error: any) {
    console.error("💥 [TEST CHARACTER] Error:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Failed to test character analysis" 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
