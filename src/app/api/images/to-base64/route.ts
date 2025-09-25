import { NextRequest, NextResponse } from 'next/server';
import { downloadImageAsBase64 } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { imagePaths } = await req.json();

    if (!imagePaths || !Array.isArray(imagePaths)) {
      return NextResponse.json(
        { error: 'Missing or invalid imagePaths array' },
        { status: 400 }
      );
    }

    console.log('🔄 [BASE64 CONVERSION] Converting images to base64:', imagePaths);

    // Convert all images to base64 in parallel
    const base64Images = await Promise.all(
      imagePaths.map(async (path: string) => {
        try {
          const base64 = await downloadImageAsBase64(path);
          return { path, base64 };
        } catch (error) {
          console.error(`❌ [BASE64 CONVERSION] Error converting ${path}:`, error);
          throw new Error(`Failed to convert image ${path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      })
    );

    console.log('✅ [BASE64 CONVERSION] Successfully converted all images');

    return NextResponse.json({
      success: true,
      images: base64Images
    });

  } catch (error) {
    console.error('❌ [BASE64 CONVERSION] Unexpected error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to convert images to base64',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
