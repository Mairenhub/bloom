import { NextRequest } from "next/server";
import { createKlingHeaders, getKlingBaseUrl, stripDataUrlPrefix } from "@/lib/kling";

export async function POST(req: NextRequest) {
  try {
    
    const body = await req.json();

    const {
      model_name = "kling-v2-1",
      image,
      image_tail,
      prompt,
      negative_prompt,
      mode = "pro",
      duration = "5",
      aspect_ratio = "16:9",
      callback_url,
      external_task_id,
    } = body;

    if (!image) {
      return new Response(JSON.stringify({ error: "image is required" }), { status: 400 });
    }
    if (!image_tail) {
      return new Response(JSON.stringify({ error: "image_tail is required" }), { status: 400 });
    }
    if (!prompt) {
      return new Response(JSON.stringify({ error: "prompt is required" }), { status: 400 });
    }

    // Use correct image2video format with image and image_tail
    const payload = {
      model_name,
      image: stripDataUrlPrefix(image),
      image_tail: stripDataUrlPrefix(image_tail),
      prompt,
      negative_prompt,
      mode,
      duration,
      callback_url: callback_url ?? null,
      external_task_id,
    };


    const url = `${getKlingBaseUrl()}/v1/videos/image2video`;

    const headers = createKlingHeaders();
    const fetchOptions = {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    };

    
    
    const res = await fetch(url, fetchOptions);

    const text = await res.text();

    return new Response(text, { status: res.status, headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "unexpected error" }), { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    
    const { searchParams } = new URL(req.url);
    const qs = searchParams.toString();
    const url = `${getKlingBaseUrl()}/v1/videos/image2video${qs ? `?${qs}` : ""}`;
    
    
    const fetchOptions = {
      headers: createKlingHeaders(),
    };
    
    console.log("🔧 [API DEBUG] Using built-in fetch for GET request with correct API domain and JWT auth");
    
    const res = await fetch(url, fetchOptions);
    
    console.log("📡 [API DEBUG] GET Response received:");
    console.log("  - Status:", res.status);
    console.log("  - Status Text:", res.statusText);
    
    const text = await res.text();
    return new Response(text, { status: res.status, headers: { "Content-Type": "application/json" } });
  } catch (err: any) {
    console.log("💥 [API DEBUG] GET Error caught:", err);
    console.log("💥 [API DEBUG] GET Error message:", err?.message);
    return new Response(JSON.stringify({ error: err?.message || "unexpected error" }), { status: 500 });
  }
}
