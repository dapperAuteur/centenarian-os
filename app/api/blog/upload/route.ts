// app/api/blog/upload/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * POST /api/blog/upload
 * Returns Cloudinary signed upload parameters for client-side uploads.
 * Auth required — users can only upload to their own folder.
 *
 * The client uses these params with the Cloudinary Upload Widget's
 * generateSignature callback to perform a secure signed upload.
 *
 * Body: { mediaType: 'image' | 'video' }
 *
 * Returns: { signature, timestamp, cloudName, apiKey, folder }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const mediaType = body.mediaType === 'video' ? 'video' : 'image';

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  const folder = process.env.CLOUDINARY_UPLOAD_FOLDER || 'blog';

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json({ error: 'Cloudinary not configured' }, { status: 500 });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const userFolder = `${folder}/${user.id}`;

  // Parameters to sign — must be sorted alphabetically
  const paramsToSign: Record<string, string | number> = {
    folder: userFolder,
    timestamp,
  };

  // Build the string to sign: key=value pairs sorted alphabetically, joined with &
  const signatureString =
    Object.keys(paramsToSign)
      .sort()
      .map((key) => `${key}=${paramsToSign[key]}`)
      .join('&') + apiSecret;

  const signature = crypto
    .createHash('sha1')
    .update(signatureString)
    .digest('hex');

  return NextResponse.json({
    signature,
    timestamp,
    cloudName,
    apiKey,
    folder: userFolder,
    mediaType,
  });
}
