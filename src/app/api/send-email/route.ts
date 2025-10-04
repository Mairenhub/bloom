import { NextRequest } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    console.log("📧 [EMAIL API] Starting email send process");
    
    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.error("❌ [EMAIL API] RESEND_API_KEY environment variable is not set");
      return new Response(JSON.stringify({ 
        error: "Email service not configured" 
      }), { status: 500 });
    }
    
    const body = await req.json();
    const { email, downloadUrl, sessionId, type = 'download' } = body;
    
    if (!email) {
      console.error("❌ [EMAIL API] Missing email parameter");
      return new Response(JSON.stringify({ 
        error: "email is required" 
      }), { status: 400 });
    }

    if (!downloadUrl && type === 'download') {
      console.error("❌ [EMAIL API] Missing downloadUrl for download type email");
      return new Response(JSON.stringify({ 
        error: "downloadUrl is required for download type emails" 
      }), { status: 400 });
    }

    console.log("📧 [EMAIL API] Processing email request:", { 
      email: email.substring(0, 3) + '***', // Mask email for privacy
      type, 
      sessionId,
      hasDownloadUrl: !!downloadUrl 
    });

    const { data, error } = await resend.emails.send({
      from: 'Bloom <noreply@openiris.app>',
      to: [email],
      subject: type === 'notification' ? '🎬 Video Update Notification' : '🎬 Your AI Video is Ready!',
      html: type === 'notification' ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #333; font-size: 28px; margin-bottom: 10px;">🎬 Video Update</h1>
            <p style="color: #666; font-size: 16px;">Thank you for using Bloom AI Video Generator</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <h2 style="color: #333; margin-bottom: 15px;">Video Processing Update</h2>
            <p style="color: #666; margin-bottom: 20px;">
              Your AI-generated video is being processed and will be ready soon. We'll notify you when it's available for download.
            </p>
            <p style="color: #666; margin-bottom: 20px;">
              Session ID: ${sessionId}
            </p>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center;">
            <p style="color: #999; font-size: 14px; margin: 0;">
              You'll receive another email when your video is ready for download.
            </p>
          </div>
        </div>
      ` : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #333; font-size: 28px; margin-bottom: 10px;">🎬 Your Video is Ready!</h1>
            <p style="color: #666; font-size: 16px;">Thank you for using bloom AI Video Generator</p>
          </div>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px;">
            <h2 style="color: #333; margin-bottom: 15px;">Download Your Video</h2>
            <p style="color: #666; margin-bottom: 20px;">
              Your AI-generated video has been successfully created and is ready for download.
            </p>
            <a 
              href="${downloadUrl}" 
              download="bloom-video.mp4"
              style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;"
            >
              Download Video
            </a>
          </div>
          
          <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center;">
            <p style="color: #999; font-size: 14px; margin: 0;">
              This link will remain active for 7 days. If you have any questions, please contact support.
            </p>
          </div>
        </div>
      `,
    });

    if (error) {
      const duration = Date.now() - startTime;
      console.error("❌ [EMAIL API] Resend error:", {
        error,
        duration: `${duration}ms`,
        email: email.substring(0, 3) + '***',
        sessionId
      });
      return new Response(JSON.stringify({ 
        error: "Failed to send email",
        details: error
      }), { status: 500 });
    }

    const duration = Date.now() - startTime;
    console.log("✅ [EMAIL API] Email sent successfully:", {
      messageId: data?.id,
      duration: `${duration}ms`,
      email: email.substring(0, 3) + '***',
      sessionId
    });

    return new Response(JSON.stringify({
      success: true,
      messageId: data?.id,
      message: "Email sent successfully",
      duration: `${duration}ms`
    }), { 
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: unknown) {
    const duration = Date.now() - startTime;
    console.error("💥 [EMAIL API] Unexpected error:", {
      error: error instanceof Error ? error.message : error,
      duration: `${duration}ms`,
      stack: error instanceof Error ? error.stack : undefined
    });
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Failed to send email",
      duration: `${duration}ms`
    }), { status: 500 });
  }
}
