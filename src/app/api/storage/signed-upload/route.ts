import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  try {
    const { userId, fileName, mimeType } = await req.json();

    if (!userId || !fileName || !mimeType) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, fileName, mimeType' },
        { status: 400 }
      );
    }

    // Generate a unique path with user ID and date structure
    const ext = fileName.split('.').pop();
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const uuid = crypto.randomUUID();
    const key = `${userId}/${year}/${month}/${uuid}.${ext}`;

    console.log('📤 [SIGNED UPLOAD] Creating signed URL for:', key);

    // Create a signed upload URL
    const { data, error } = await supabaseAdmin
      .storage
      .from('uploads')
      .createSignedUploadUrl(key);

    if (error) {
      console.error('❌ [SIGNED UPLOAD] Error creating signed URL:', error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    console.log('✅ [SIGNED UPLOAD] Signed URL created successfully');

    return NextResponse.json({
      url: data.signedUrl,
      path: key,
      token: data.token
    });

  } catch (error) {
    console.error('❌ [SIGNED UPLOAD] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
