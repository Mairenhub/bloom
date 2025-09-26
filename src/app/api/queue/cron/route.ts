import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    console.log("⏰ [QUEUE CRON] Starting scheduled queue processing");
    
    // Debug environment variables
    console.log("🔍 [QUEUE CRON] Environment check:", {
      NEXT_PUBLIC_BASE_URL: process.env.NEXT_PUBLIC_BASE_URL,
      VERCEL_URL: process.env.VERCEL_URL,
      NODE_ENV: process.env.NODE_ENV
    });
    
    // Always use the production URL to avoid deployment protection issues
    const baseUrl = 'https://bloom-beta-kohl.vercel.app';
    
    console.log("🌐 [QUEUE CRON] Using base URL:", baseUrl);
    
    // Call the queue processor
    const processorUrl = `${baseUrl}/api/queue/process`;
    
    const response = await fetch(processorUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error("❌ [QUEUE CRON] Queue processor failed:", response.status, errorText);
      throw new Error(`Queue processor failed: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    console.log("✅ [QUEUE CRON] Queue processing completed:", result);
    
    return new Response(JSON.stringify({
      message: "Cron job executed successfully",
      result
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error: any) {
    console.error("💥 [QUEUE CRON] Error executing cron job:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Failed to execute cron job" 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
