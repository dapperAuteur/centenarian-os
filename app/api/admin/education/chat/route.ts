// app/api/admin/education/chat/route.ts
// Admin-only: AI chat for codebase education (interview/pitch/onboarding prep).

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { CODEBASE_CONTEXT } from '@/lib/admin/codebase-context';

const GEMINI_MODEL = 'gemini-2.5-flash';

async function getAdminUser() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name: string) => cookieStore.get(name)?.value,
        set: (name: string, value: string, options: CookieOptions) => {
          try { cookieStore.set({ name, value, ...options }); } catch {}
        },
        remove: (name: string, options: CookieOptions) => {
          try { cookieStore.set({ name, value: '', ...options }); } catch {}
        },
      },
    },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}

const MODE_INSTRUCTIONS: Record<string, string> = {
  interview: 'The admin is preparing for a technical interview. Help them articulate architecture decisions, trade-offs, scaling considerations, and technical depth. Anticipate follow-up questions an interviewer might ask. Give concrete examples from the codebase.',
  investor: 'The admin is preparing for an investor pitch. Focus on business value, market differentiation, user metrics potential, revenue model, and technical moat. Keep language accessible to non-technical audiences while demonstrating sophistication.',
  onboarding: 'The admin is preparing to onboard a new team member. Explain things clearly with context. Cover project structure, key conventions, development workflow, and where to find things in the codebase.',
  demo: 'The admin is preparing a feature demo. Help structure talking points, highlight user benefits, suggest demo flows, and anticipate audience questions. Focus on what makes features impressive and unique.',
  general: 'Answer questions about the codebase architecture, features, and technical decisions. Be thorough and specific.',
};

export async function POST(req: NextRequest) {
  const adminUser = await getAdminUser();
  if (!adminUser || adminUser.email !== process.env.ADMIN_EMAIL) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { message, history, mode } = await req.json() as {
    message: string;
    history: ChatMessage[];
    mode?: string;
  };

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'GOOGLE_GEMINI_API_KEY not configured' }, { status: 500 });
  }

  const modePrompt = MODE_INSTRUCTIONS[mode ?? 'general'] ?? MODE_INSTRUCTIONS.general;

  const systemPrompt = `You are an expert AI assistant helping the founder/admin of CentenarianOS prepare for presentations, interviews, and discussions about their product and its technical architecture.

${modePrompt}

Be direct, specific, and substantive. Use concrete examples from the codebase when possible. Structure longer answers with clear headings or bullet points using markdown formatting.

--- CODEBASE REFERENCE ---
${CODEBASE_CONTEXT}
--- END REFERENCE ---`;

  const contents: ChatMessage[] = [
    ...(history || []),
    { role: 'user', parts: [{ text: message }] },
  ];

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      console.error('[admin/education/chat] Gemini error:', errBody);
      return NextResponse.json({ error: 'AI model error' }, { status: 500 });
    }

    const result = await res.json();
    const reply = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      return NextResponse.json({ error: 'No response from AI model' }, { status: 500 });
    }

    return NextResponse.json({ message: reply });
  } catch (err) {
    console.error('[admin/education/chat] Error:', err);
    return NextResponse.json({ error: 'Failed to reach AI service' }, { status: 500 });
  }
}
