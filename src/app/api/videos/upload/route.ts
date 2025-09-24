import { NextRequest } from "next/server";
import { uploadVideo } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    console.log("📤 [UPLOAD API] Starting video upload");
    
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const taskId = formData.get('taskId') as string;
    
    if (!file || !taskId) {
      return new Response(JSON.stringify({ 
        error: "file and taskId are required" 
      }), { status: 400 });
    }

    console.log("📤 [UPLOAD API] Uploading file:", {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      taskId
    });
    
    // Upload to Supabase Storage
    const supabaseUrl = await uploadVideo(file, taskId);
    
    console.log("✅ [UPLOAD API] Video uploaded successfully:", supabaseUrl);
    
    return new Response(JSON.stringify({
      success: true,
      url: supabaseUrl,
      taskId
    }), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: any) {
    console.error("❌ [UPLOAD API] Error uploading video:", error);
    return new Response(JSON.stringify({ 
      error: error?.message || "Failed to upload video" 
    }), { status: 500 });
  }
}
