import { NextRequest } from "next/server";
import { createCode } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { packageType } = body;
    
    if (!packageType || !['5-photos', '10-photos'].includes(packageType)) {
      return new Response(JSON.stringify({ 
        error: "Valid package type is required (5-photos or 10-photos)" 
      }), { 
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log("🔍 [ADMIN] Generating code for package:", packageType);
    
    const codeData = await createCode(packageType, {
      generatedBy: 'admin',
      generatedAt: new Date().toISOString()
    });
    
    return new Response(JSON.stringify({
      success: true,
      id: codeData.id,
      code: codeData.code,
      package_type: codeData.package_type,
      created_at: codeData.created_at
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("❌ [ADMIN] Error generating code:", error);
    return new Response(JSON.stringify({ 
      error: error.message || "Failed to generate code" 
    }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
