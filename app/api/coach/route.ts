/* eslint-disable @typescript-eslint/no-explicit-any */
// File: app/api/coach/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { GeminiMessage, AttachmentMeta } from '@/lib/types';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { fetchDataContext, DataSourceKey } from '@/lib/gemini/data-fetchers';
import { parseActionsFromText, stripActionBlocks } from '@/lib/gemini/gemini-parser';
import { executeActions, ActionResult } from '@/lib/gemini/action-executor';

// The Gemini API model to use
const GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Base directive prepended to every gem's system prompt.
 * Enforces critical-partner tone across all gems.
 */
const BASE_DIRECTIVE = `CORE DIRECTIVES — these override everything else:
- You are a critical partner, not a cheerleader. Challenge assumptions. Point out flaws. Push back when the data contradicts what the user wants to hear.
- No praise-padding. Skip "great question" / "that's a wonderful idea" / "I love that" filler. Get to the point.
- Honest assessment over encouragement. If the numbers are bad, say so directly. If an idea has holes, call them out before offering solutions.
- Disagree when warranted. A yes-man is useless. The value is in surfacing what the user isn't seeing.
- Be direct, concise, and substantive. Every sentence should carry information or provoke thought.`;

// ── File handling constants ──────────────────────────────────────────
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 5;
const MAX_CSV_DISPLAY_ROWS = 500;
const ALLOWED_MIME_TYPES = new Set([
  'text/csv',
  'text/plain',
  'text/markdown',
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
]);

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface SessionFileData {
  name: string;
  headers?: string[];
  rows?: Record<string, string>[];
}

interface ParsedFlashcard {
  front: string;
  back: string;
}

/**
 * Parse a CSV string into an array of header-keyed objects.
 */
function parseCsvToRows(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return { headers: [], rows: [] };

  // Parse a single CSV line respecting quoted fields
  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  };

  const headers = parseLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? '';
    }
    rows.push(row);
  }

  return { headers, rows };
}

/**
 * Process uploaded files into Gemini-compatible parts + session file data.
 */
async function processFiles(files: File[]): Promise<{
  geminiParts: GeminiPart[];
  attachmentMeta: AttachmentMeta[];
  fileData: SessionFileData[];
}> {
  const geminiParts: GeminiPart[] = [];
  const attachmentMeta: AttachmentMeta[] = [];
  const fileData: SessionFileData[] = [];

  for (const file of files) {
    attachmentMeta.push({
      name: file.name,
      mimeType: file.type,
      size: file.size,
    });

    const bytes = await file.arrayBuffer();

    if (file.type === 'text/csv' || file.type === 'text/plain' || file.type === 'text/markdown') {
      const textContent = new TextDecoder().decode(bytes);

      // For CSV files, parse into structured rows for import actions
      if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
        const { headers, rows } = parseCsvToRows(textContent);
        fileData.push({ name: file.name, headers, rows });

        // Truncate display for Gemini if CSV is very large
        const displayLines = textContent.split('\n');
        const totalRows = displayLines.length - 1; // minus header
        let displayText: string;
        if (totalRows > MAX_CSV_DISPLAY_ROWS) {
          displayText = displayLines.slice(0, MAX_CSV_DISPLAY_ROWS + 1).join('\n');
          displayText += `\n\n[Truncated: showing ${MAX_CSV_DISPLAY_ROWS} of ${totalRows} rows. All ${totalRows} rows are available for import.]`;
        } else {
          displayText = textContent;
        }
        geminiParts.push({
          text: `--- FILE: ${file.name} (${file.type}, ${totalRows} rows) ---\n${displayText}\n--- END FILE ---`,
        });
      } else {
        // Plain text / markdown — send as text part
        geminiParts.push({
          text: `--- FILE: ${file.name} (${file.type}) ---\n${textContent}\n--- END FILE ---`,
        });
      }
    } else {
      // Binary files (PDF, images) — send as base64 inlineData
      const base64 = Buffer.from(bytes).toString('base64');
      geminiParts.push({
        inlineData: {
          mimeType: file.type,
          data: base64,
        },
      });
    }
  }

  return { geminiParts, attachmentMeta, fileData };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await (await supabase).auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ── Parse request (FormData or JSON) ─────────────────────────────
    const contentType = req.headers.get('content-type') || '';
    let message: string;
    let gemPersonaId: string;
    let existingSessionId: string | undefined;
    let files: File[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      message = formData.get('message') as string;
      gemPersonaId = formData.get('gemPersonaId') as string;
      existingSessionId = (formData.get('sessionId') as string) || undefined;
      files = formData.getAll('files') as File[];
    } else {
      const body = await req.json();
      message = body.message;
      gemPersonaId = body.gemPersonaId;
      existingSessionId = body.sessionId;
    }

    if (!message || !gemPersonaId) {
      return NextResponse.json({ error: 'Missing message or gemPersonaId' }, { status: 400 });
    }

    // ── Validate files ───────────────────────────────────────────────
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `Maximum ${MAX_FILES} files allowed` }, { status: 400 });
    }
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: `File "${file.name}" exceeds 10MB limit` }, { status: 400 });
      }
      if (!ALLOWED_MIME_TYPES.has(file.type) && !file.name.endsWith('.csv')) {
        return NextResponse.json({ error: `File type "${file.type}" is not supported` }, { status: 400 });
      }
    }

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_GEMINI_API_KEY is not set');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    // Fetch persona with new columns
    const { data: personaData, error: personaError } = await (await supabase)
      .from('gem_personas')
      .select('system_prompt, data_sources, can_take_actions')
      .eq('id', gemPersonaId)
      .eq('user_id', user.id)
      .single();

    if (personaError || !personaData) {
      console.error('Error fetching persona:', personaError);
      return NextResponse.json({ error: 'Could not find Gem Persona' }, { status: 404 });
    }

    // Build full system prompt: base directive + gem prompt + data context + knowledge base
    const dataSources = (personaData.data_sources || []) as DataSourceKey[];
    let dataContext = '';

    const adminDb = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    if (dataSources.length > 0) {
      dataContext = await fetchDataContext(adminDb, user.id, dataSources);
    }

    // Fetch persistent knowledge base documents for this gem
    const { data: gemDocs } = await adminDb
      .from('gem_documents')
      .select('name, content')
      .eq('gem_persona_id', gemPersonaId)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    const kbContext = (gemDocs && gemDocs.length > 0)
      ? gemDocs.map((d: { name: string; content: string }) =>
          `--- KNOWLEDGE BASE: ${d.name} ---\n${d.content}\n--- END ---`
        ).join('\n\n')
      : '';

    let fullSystemPrompt = `${BASE_DIRECTIVE}\n\n${personaData.system_prompt}`;
    if (dataContext) {
      fullSystemPrompt += `\n\n--- YOUR USER'S CURRENT DATA ---\n${dataContext}\n--- END DATA ---`;
    }
    if (kbContext) {
      fullSystemPrompt += `\n\n--- KNOWLEDGE BASE DOCUMENTS ---\n${kbContext}\n--- END KNOWLEDGE BASE ---`;
    }

    let sessionId = existingSessionId;
    let chatHistory: GeminiMessage[] = [];
    let existingFileData: SessionFileData[] = [];

    // Fetch existing chat history OR create a new session
    if (sessionId) {
      const { data: sessionData, error: sessionError } = await (await supabase)
        .from('language_coach_sessions')
        .select('messages, file_data')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (!sessionError && sessionData) {
        chatHistory = (sessionData.messages as GeminiMessage[]) || [];
        existingFileData = (sessionData.file_data as SessionFileData[]) || [];
      } else {
        sessionId = undefined;
      }
    }

    // ── Process files ────────────────────────────────────────────────
    let geminiFileParts: GeminiPart[] = [];
    let attachmentMeta: AttachmentMeta[] = [];
    let newFileData: SessionFileData[] = [];

    if (files.length > 0) {
      const processed = await processFiles(files);
      geminiFileParts = processed.geminiParts;
      attachmentMeta = processed.attachmentMeta;
      newFileData = processed.fileData;
    }

    // Merge new file data with existing (replace files with same name)
    const mergedFileData = [...existingFileData];
    for (const nf of newFileData) {
      const idx = mergedFileData.findIndex(f => f.name === nf.name);
      if (idx >= 0) {
        mergedFileData[idx] = nf;
      } else {
        mergedFileData.push(nf);
      }
    }

    // Build the user message for STORAGE (metadata only, no file content)
    const userMessageForStorage: GeminiMessage = {
      role: 'user',
      parts: [{ text: message }],
      ...(attachmentMeta.length > 0 && { attachments: attachmentMeta }),
    };
    chatHistory.push(userMessageForStorage);

    // Build the Gemini contents: previous messages text-only,
    // current message includes file parts alongside text
    const geminiContents = chatHistory.map((msg, index) => {
      if (index === chatHistory.length - 1 && msg.role === 'user' && geminiFileParts.length > 0) {
        return {
          role: 'user',
          parts: [{ text: message }, ...geminiFileParts],
        };
      }
      return { role: msg.role, parts: msg.parts };
    });

    // Call the Gemini API
    const payload = {
      contents: geminiContents,
      systemInstruction: {
        parts: [{ text: fullSystemPrompt }]
      },
    };

    const apiResponse = await fetch(GEMINI_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!apiResponse.ok) {
      const errorBody = await apiResponse.text();
      console.error('Gemini API Error:', errorBody);
      return NextResponse.json({ error: 'Error calling AI model', details: errorBody }, { status: 500 });
    }

    const result = await apiResponse.json();
    const modelResponseText = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!modelResponseText) {
      return NextResponse.json({ error: 'No response from AI model' }, { status: 500 });
    }

    // Parse and execute actions if enabled
    let actionResults: ActionResult[] = [];
    let displayText = modelResponseText;

    if (personaData.can_take_actions) {
      const actions = parseActionsFromText(modelResponseText);
      if (actions.length > 0) {
        const adminDb = createAdminClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!,
        );
        actionResults = await executeActions(
          adminDb,
          user.id,
          sessionId ?? null,
          gemPersonaId,
          actions,
          mergedFileData,
        );
        displayText = stripActionBlocks(modelResponseText);
      }
    }

    // Save full response (including action blocks) to chat history
    const modelMessage: GeminiMessage = { role: 'model', parts: [{ text: modelResponseText }] };
    chatHistory.push(modelMessage);

    // Save session
    if (!sessionId) {
      const { data: newSession, error: newSessionError } = await (await supabase)
        .from('language_coach_sessions')
        .insert({
          user_id: user.id,
          gem_persona_id: gemPersonaId,
          messages: chatHistory as any,
          file_data: mergedFileData as any,
        })
        .select('id')
        .single();

      if (newSessionError) {
        console.error('Error creating new chat session:', newSessionError);
      } else {
        sessionId = newSession.id;
      }
    } else {
      const { error: updateError } = await (await supabase)
        .from('language_coach_sessions')
        .update({
          messages: chatHistory as any,
          file_data: mergedFileData as any,
        })
        .eq('id', sessionId)
        .eq('user_id', user.id);

      if (updateError) {
        console.error('Error updating chat session:', updateError);
      }
    }

    // Process flashcards in background (uses original text, not stripped)
    processFlashcards(modelResponseText, user.id, gemPersonaId)
      .catch(err => console.error('Background flashcard processing failed:', err));

    // Return stripped display text + action results
    return NextResponse.json({
      message: displayText,
      sessionId,
      actions: actionResults.length > 0 ? actionResults : undefined,
    });

  } catch (error) {
    console.error('Error in /api/coach:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * Background Flashcard Processor — unchanged from original.
 */
async function processFlashcards(responseText: string, userId: string, gemPersonaId: string) {
  const flashcardBlockRegex = /\[START_FLASHCARDS\]([\s\S]*?)\[END_FLASHCARDS\]/g;
  const flashcardRegex = /F::(.*?)\nB::(.*?)(?=\nF::|\n*$)/g;

  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  let match;
  while ((match = flashcardBlockRegex.exec(responseText)) !== null) {
    const blockContent = match[1].trim();
    const flashcards: ParsedFlashcard[] = [];

    let cardMatch;
    while ((cardMatch = flashcardRegex.exec(blockContent)) !== null) {
      flashcards.push({
        front: cardMatch[1].trim(),
        back: cardMatch[2].trim(),
      });
    }

    if (flashcards.length > 0) {
      console.log(`Found ${flashcards.length} flashcards to create.`);

      const { data: persona } = await supabase
        .from('gem_personas')
        .select('name')
        .eq('id', gemPersonaId)
        .single();

      const personaName = persona?.name || 'Language';
      const language = personaName.includes('Spanish') ? 'Spanish' : 'General';

      const { data: set, error: setError } = await supabase
        .from('flashcard_sets')
        .insert({
          user_id: userId,
          title: `${language} Flashcards - ${new Date().toLocaleDateString()}`,
          language: language,
        })
        .select('id')
        .single();

      if (setError || !set) {
        console.error('Error creating flashcard set:', setError);
        continue;
      }

      const cardsToInsert = flashcards.map(card => ({
        set_id: set.id,
        user_id: userId,
        front_text: card.front,
        back_text: card.back,
      }));

      const { data: newCards, error: cardsError } = await supabase
        .from('flashcards')
        .insert(cardsToInsert)
        .select('id');

      if (cardsError || !newCards) {
        console.error('Error inserting flashcards:', cardsError);
      } else {
        console.log(`Successfully inserted ${newCards.length} cards.`);

        const analyticsToInsert = newCards.map(card => ({
          card_id: card.id,
          user_id: userId,
          status: 'new',
          next_review_at: new Date().toISOString(),
        }));

        const { error: analyticsError } = await supabase
          .from('flashcard_analytics')
          .insert(analyticsToInsert);

        if (analyticsError) {
          console.error('Error creating flashcard analytics:', analyticsError);
        }
      }
    }
  }
}
