// app/api/cloudinary/sign/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * POST /api/cloudinary/sign
 *
 * Canonical Cloudinary signing endpoint. Returns a signature for
 * client-side signed uploads via next-cloudinary's CldUploadWidget.
 * Auth required.
 *
 * The client (CldUploadWidget) sends `{ paramsToSign: { folder, timestamp, source, ... } }`
 * and we sign exactly what the widget sends — nothing more, nothing less.
 * Params excluded from the signature: file, resource_type, api_key, cloud_name.
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
