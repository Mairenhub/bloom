import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  try {
    console.log("⏰ [QUEUE CRON] Starting scheduled queue processing");
    
    // Call the queue processor
    const processorUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/queue/process`;
    
    const response = await fetch(processorUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Queue processor failed: ${response.status}`);
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
