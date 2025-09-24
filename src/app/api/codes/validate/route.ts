import { NextRequest } from "next/server";
import { validateCode } from "@/lib/supabase";

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

    console.log("🔍 [CODE VALIDATION] Validating code:", code);
    
    const codeData = await validateCode(code);
    
    if (!codeData) {
      return new Response(JSON.stringify({ 
        valid: false,
        error: "Invalid or expired code" 
      }), { 
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({
      valid: true,
      packageType: codeData.package_type,
      code: codeData.code
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("❌ [CODE VALIDATION] Error:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Failed to validate code" 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
