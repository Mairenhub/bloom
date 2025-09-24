import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.NEXT_PUBLIC_OPENAI_KEY,
});

// Base training prompt for cinematic character transitions
const BASE_TRAINING_PROMPT = `A continuous cinematic sequence of a person walking out of one frame and entering the next. It must be the same person, but its appearance changes during the transition between frames. The walk should feel natural and seamless: he exits on one side, then reappears in the next frame. The transformation should be clear but consistent — hairstyle, clothing, or style can shift, but his body proportions and facial structure should remain recognizable to show it is the same person but only a bit older. Smooth, film-like motion.`;

export type TransitionPrompt = {
  fromFrameId: string;
  toFrameId: string;
  userInput: string;
  enhancedPrompt?: string;
};

export type BatchPromptResult = {
  transitions: TransitionPrompt[];
  success: boolean;
  error?: string;
};

// Simple function to combine base training with user input (fallback)
function combineWithBaseTraining(userInput: string): string {
  if (!userInput.trim()) {
    return BASE_TRAINING_PROMPT;
  }
  
  return `${BASE_TRAINING_PROMPT} ${userInput}`;
}

// Enhanced function to intelligently combine prompts using OpenAI
async function combinePromptsWithAI(userInput: string, context?: {
  fromImage?: string;
  toImage?: string;
  duration?: number;
  style?: string;
}): Promise<string> {
  if (!process.env.NEXT_PUBLIC_OPENAI_KEY) {
    console.log("⚠️ [OPENAI DEBUG] No OpenAI API key found, using basic combination");
    return combineWithBaseTraining(userInput);
  }

  if (!userInput.trim()) {
    return BASE_TRAINING_PROMPT;
  }

  try {
    const systemPrompt = `You are a KlingAI video prompt expert. Your job is to create the perfect video generation prompt by intelligently combining the base training prompt with the user's specific movement/action request.

BASE TRAINING PROMPT:
"${BASE_TRAINING_PROMPT}"

INSTRUCTIONS:
1. Analyze the user's input to understand the specific movement, action, or transition they want
2. Create a seamless, natural combination that maintains the cinematic character continuity from the base training
3. Ensure the movement flows naturally from the base training concept
4. Make the prompt specific and actionable for video generation
5. Keep the same person/character throughout the transition
6. Focus on smooth, film-like motion and natural transitions

Return ONLY the enhanced prompt, no explanations or additional text.`;

    const userMessage = `User wants: "${userInput}"`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userMessage
        }
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const response = completion.choices[0]?.message?.content;
    
    if (!response) {
      throw new Error("No response from OpenAI");
    }

    console.log("🤖 [OPENAI DEBUG] AI-combined prompt:", response);
    return response.trim();

  } catch (error) {
    console.error("❌ [OPENAI DEBUG] Error combining prompts with AI:", error);
    // Fall back to basic combination
    return combineWithBaseTraining(userInput);
  }
}

// Generate prompts for multiple transitions in one API call
export async function generateBatchPrompts(transitions: TransitionPrompt[]): Promise<BatchPromptResult> {
  console.log("🤖 [OPENAI DEBUG] Generating batch prompts for", transitions.length, "transitions");
  
  if (!process.env.NEXT_PUBLIC_OPENAI_KEY) {
    console.log("⚠️ [OPENAI DEBUG] No OpenAI API key found, using basic training");
    return {
      transitions: transitions.map(t => ({
        ...t,
        enhancedPrompt: combineWithBaseTraining(t.userInput)
      })),
      success: true
    };
  }

  try {
    const systemPrompt = `You are a KlingAI video prompt expert. For each transition, combine the base training prompt with the user's specific instruction.

BASE TRAINING PROMPT:
"${BASE_TRAINING_PROMPT}"

For each user input, create a seamless combination that maintains the base training while incorporating the user's specific direction.

Return JSON array: [{"fromFrameId": "...", "toFrameId": "...", "enhancedPrompt": "..."}]`;

    const userMessages = transitions.map(t => 
      `Transition ${t.fromFrameId} → ${t.toFrameId}: "${t.userInput}"`
    ).join('\n');

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Generate enhanced prompts for these transitions:\n${userMessages}`
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const response = completion.choices[0]?.message?.content;
    console.log("🤖 [OPENAI DEBUG] Raw response:", response);

    if (!response) {
      throw new Error("No response from OpenAI");
    }

    // Try to parse JSON response
    let enhancedTransitions;
    try {
      enhancedTransitions = JSON.parse(response);
    } catch (parseError) {
      // If not JSON, fall back to basic training
      console.log("⚠️ [OPENAI DEBUG] Could not parse JSON, using basic training");
      enhancedTransitions = transitions.map(t => ({
        fromFrameId: t.fromFrameId,
        toFrameId: t.toFrameId,
        enhancedPrompt: combineWithBaseTraining(t.userInput)
      }));
    }

    // Ensure all transitions have enhanced prompts
    const result = await Promise.all(transitions.map(async t => {
      const enhanced = enhancedTransitions.find((et: any) => 
        et.fromFrameId === t.fromFrameId && et.toFrameId === t.toFrameId
      );
      
      // Use AI-powered combination if available, otherwise fall back to basic
      const enhancedPrompt = enhanced?.enhancedPrompt || await combinePromptsWithAI(t.userInput);
      
      return {
        ...t,
        enhancedPrompt
      };
    }));

    console.log("✅ [OPENAI DEBUG] Generated batch prompts:", result.length);
    return {
      transitions: result,
      success: true
    };

  } catch (error) {
    console.error("❌ [OPENAI DEBUG] Error generating batch prompts:", error);
    return {
      transitions: transitions.map(t => ({
        ...t,
        enhancedPrompt: combineWithBaseTraining(t.userInput)
      })),
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Legacy function for single prompt enhancement (for backward compatibility)
export async function enhancePromptForKlingAI(
  originalPrompt: string,
  context?: {
    fromImage?: string;
    toImage?: string;
    duration?: number;
    style?: string;
  }
): Promise<{ enhancedPrompt: string; originalPrompt: string; reasoning: string }> {
  try {
    // Use the new AI-powered prompt combination
    const enhancedPrompt = await combinePromptsWithAI(originalPrompt, context);
    
    return {
      enhancedPrompt,
      originalPrompt,
      reasoning: "AI intelligently combined base training with user movement"
    };
  } catch (error) {
    console.error("❌ [OPENAI DEBUG] Error in enhancePromptForKlingAI:", error);
    
    // Fall back to the old batch method
    const result = await generateBatchPrompts([{
      fromFrameId: 'legacy',
      toFrameId: 'legacy',
      userInput: originalPrompt
    }]);

    return {
      enhancedPrompt: result.transitions[0]?.enhancedPrompt || combineWithBaseTraining(originalPrompt),
      originalPrompt,
      reasoning: result.success ? "AI enhanced with base training (fallback)" : "Fallback to basic training"
    };
  }
}
