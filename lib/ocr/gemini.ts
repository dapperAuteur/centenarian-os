// lib/ocr/gemini.ts — Shared Gemini Vision API wrapper for OCR

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export interface GeminiImagePart {
  inlineData: { mimeType: string; data: string };
}

/** Convert File objects to base64 inline data parts for Gemini Vision */
export async function filesToImageParts(
  files: File[],
  maxFiles = 4,
): Promise<GeminiImagePart[]> {
  const parts: GeminiImagePart[] = [];
  for (const file of files.slice(0, maxFiles)) {
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    parts.push({
      inlineData: {
        mimeType: file.type || 'image/jpeg',
        data: base64,
      },
    });
  }
  return parts;
}

/** Send a prompt + images to Gemini and get parsed JSON back */
export async function callGemini<T>(
  prompt: string,
  imageParts: GeminiImagePart[],
): Promise<T> {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key not configured');

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [{ text: prompt }, ...imageParts],
      },
    ],
    generationConfig: { responseMimeType: 'application/json' },
  };

  const res = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error: ${err}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  return JSON.parse(rawText) as T;
}
