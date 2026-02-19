// app/api/recipes/upload/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * POST /api/recipes/upload
 * Returns Cloudinary signed upload parameters for client-side recipe media uploads.
 * Auth required — users can only upload to their own folder.
 *
 * The client uses these params with the Cloudinary Upload Widget's
 * generateSignature callback to perform a secure signed upload.
 *
 * Returns: { signature }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!apiSecret) {
    return NextResponse.json({ error: 'Cloudinary not configured' }, { status: 500 });
  }

  const body = await request.json();
  const paramsToSign: Record<string, string | number> = body.paramsToSign ?? body;

  // Params excluded from Cloudinary signatures: file, resource_type, api_key, cloud_name
  const excluded = new Set(['file', 'resource_type', 'api_key', 'cloud_name']);
  const signableParams = Object.fromEntries(
    Object.entries(paramsToSign).filter(([k]) => !excluded.has(k))
  );

  const signatureString =
    Object.keys(signableParams)
      .sort()
      .map((key) => `${key}=${signableParams[key]}`)
      .join('&') + apiSecret;

  const signature = crypto
    .createHash('sha1')
    .update(signatureString)
    .digest('hex');

  return NextResponse.json({ signature });
}
