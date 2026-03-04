// app/api/ocr/scan/route.ts
// Universal Smart Scan endpoint: classifies document type + extracts structured data.
// Optionally uploads receipt image to Cloudinary based on user preference.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import {
  filesToImageParts,
  classifyDocument,
  extractDocument,
  type DocumentType,
} from '@/lib/ocr';

const SUGGESTED_MODULES: Record<string, string[]> = {
  receipt: ['finance'],
  recipe: ['recipes'],
  fuel_receipt: ['fuel'],
  maintenance_invoice: ['maintenance', 'finance'],
  medical: ['finance'],
  unknown: [],
};

const VALID_HINTS: DocumentType[] = [
  'receipt', 'recipe', 'fuel_receipt', 'maintenance_invoice', 'medical',
];

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const files = formData.getAll('images') as File[];
  const hint = formData.get('hint') as string | null;
  const saveOverride = formData.get('save_image') as string | null;

  if (!files.length) {
    return NextResponse.json({ error: 'No images provided' }, { status: 400 });
  }

  try {
    // Convert images to base64 parts
    const imageParts = await filesToImageParts(files);

    // Phase 1: Classify (skip if hint provided)
    let documentType: DocumentType;
    let confidence = 1;

    if (hint && VALID_HINTS.includes(hint as DocumentType)) {
      documentType = hint as DocumentType;
    } else {
      const classification = await classifyDocument(imageParts);
      documentType = classification.document_type;
      confidence = classification.confidence;
    }

    // Phase 2: Extract module-specific data
    const extraction = await extractDocument(documentType, imageParts);

    // Check user's auto-save preference
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: profile } = await serviceClient
      .from('profiles')
      .select('scan_auto_save_images')
      .eq('id', user.id)
      .maybeSingle();

    const shouldSave = saveOverride
      ? saveOverride === 'true'
      : profile?.scan_auto_save_images === true;

    let imageUrl: string | undefined;
    let scanImageId: string | undefined;

    if (shouldSave) {
      // Upload first image to Cloudinary
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

      if (cloudName && uploadPreset) {
        const uploadForm = new FormData();
        uploadForm.append('file', files[0]);
        uploadForm.append('upload_preset', uploadPreset);
        uploadForm.append('folder', 'receipts');

        const uploadRes = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          { method: 'POST', body: uploadForm },
        );

        if (uploadRes.ok) {
          const uploadData = await uploadRes.json();
          imageUrl = uploadData.secure_url;

          // Insert scan_images record
          const { data: scanImage } = await serviceClient
            .from('scan_images')
            .insert({
              user_id: user.id,
              document_type: documentType,
              cloudinary_url: uploadData.secure_url,
              cloudinary_public_id: uploadData.public_id,
              original_filename: files[0].name,
              scan_data: extraction.data,
              confidence,
            })
            .select('id')
            .single();

          scanImageId = scanImage?.id;
        }
      }
    }

    return NextResponse.json({
      documentType,
      confidence,
      extracted: extraction.data,
      suggestedModules: SUGGESTED_MODULES[documentType] ?? [],
      imageUrl,
      scanImageId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Scan failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
