import { NextRequest } from "next/server";
import { detectCharacterFromPrompt, generateConsistentPrompt } from "@/lib/openai";

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
    
    console.log("🧪 [TEST SIMPLE CHARACTER] Testing character detection:", prompt);
    
    // Step 1: Detect character from prompt
    const character = detectCharacterFromPrompt(prompt);
    
    // Step 2: Generate consistent prompt
    const enhancedPrompt = generateConsistentPrompt(prompt, character, videoIndex);
    
    return new Response(JSON.stringify({
      originalPrompt: prompt,
      videoIndex,
      character,
      enhancedPrompt,
      summary: {
        characterType: character.characterType,
        characterName: character.characterName,
        idCard: character.idCard,
        promptLength: enhancedPrompt.length
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error: any) {
    console.error("💥 [TEST SIMPLE CHARACTER] Error:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Failed to test character detection" 
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
    
    // Step 1: Detect character from prompt
    const character = detectCharacterFromPrompt(prompt);
    
    // Step 2: Generate consistent prompt
    const enhancedPrompt = generateConsistentPrompt(prompt, character, videoIndex);
    
    return new Response(JSON.stringify({
      originalPrompt: prompt,
      videoIndex,
      character,
      enhancedPrompt,
      summary: {
        characterType: character.characterType,
        characterName: character.characterName,
        idCard: character.idCard,
        promptLength: enhancedPrompt.length
      }
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error: any) {
    console.error("💥 [TEST SIMPLE CHARACTER] Error:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Failed to test character detection" 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
