import { NextRequest } from "next/server";
import { createKlingHeaders, getKlingBaseUrl } from "@/lib/kling";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    console.log("🔍 [POLL DEBUG] Checking task status for ID:", id);
    
    const url = `${getKlingBaseUrl()}/v1/videos/image2video/${encodeURIComponent(id)}`;
    console.log("🌐 [POLL DEBUG] Polling URL:", url);
    
    const res = await fetch(url, { headers: createKlingHeaders() });
    
    console.log("📡 [POLL DEBUG] Poll response:");
    console.log("  - Status:", res.status);
    console.log("  - Status Text:", res.statusText);
    
    const text = await res.text();
    console.log("📄 [POLL DEBUG] Response body length:", text.length);
    console.log("📄 [POLL DEBUG] Response body preview:", text.substring(0, 500));
    
    return new Response(text, { status: res.status, headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    console.log("💥 [POLL DEBUG] Error caught:", err);
    console.log("💥 [POLL DEBUG] Error message:", err?.message);
    return new Response(JSON.stringify({ error: err?.message || "unexpected error" }), { status: 500 });
  }
}
