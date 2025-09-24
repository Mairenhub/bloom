import { NextRequest } from "next/server";
import { redeemCode } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { code } = body;
    
    if (!code) {
      return new Response(JSON.stringify({ 
        error: "Code is required" 
      }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Get client IP for tracking
    const clientIP = req.headers.get('x-forwarded-for') || 
                    req.headers.get('x-real-ip') || 
                    'unknown';

    console.log("🔍 [CODE REDEMPTION] Redeeming code:", code, "by IP:", clientIP);
    
    const redeemedCode = await redeemCode(code, clientIP);
    
    return new Response(JSON.stringify({
      success: true,
      packageType: redeemedCode.package_type,
      code: redeemedCode.code,
      redeemedAt: redeemedCode.redeemed_at
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("❌ [CODE REDEMPTION] Error:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Failed to redeem code" 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
