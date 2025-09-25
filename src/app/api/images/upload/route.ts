import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { imageBase64, filename } = await request.json();

    if (!imageBase64 || !filename) {
      return NextResponse.json({ error: 'Missing imageBase64 or filename' }, { status: 400 });
    }

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageBase64, 'base64');

    // Upload to Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from('images')
      .upload(filename, imageBuffer, {
        contentType: 'image/jpeg',
        upsert: true
      });

    if (error) {
      console.error('❌ [IMAGE UPLOAD] Error uploading image:', error);
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = supabaseAdmin.storage
      .from('images')
      .getPublicUrl(filename);

    console.log(`✅ [IMAGE UPLOAD] Image uploaded successfully: ${filename}`);

    return NextResponse.json({ 
      success: true, 
      url: urlData.publicUrl,
      filename 
    });

  } catch (error) {
    console.error('❌ [IMAGE UPLOAD] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to upload image' },
      { status: 500 }
    );
  }
}
