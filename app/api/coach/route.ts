/* eslint-disable @typescript-eslint/no-explicit-any */
// File: app/api/coach/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { GeminiMessage } from '@/lib/types';
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

interface CoachRequestBody {
  message: string;
  gemPersonaId: string;
  sessionId?: string;
}

interface ParsedFlashcard {
  front: string;
  back: string;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await (await supabase).auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message, gemPersonaId, sessionId: existingSessionId }: CoachRequestBody = await req.json();

    if (!message || !gemPersonaId) {
      return NextResponse.json({ error: 'Missing message or gemPersonaId' }, { status: 400 });
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

    // Build full system prompt: base directive + gem prompt + data context
    const dataSources = (personaData.data_sources || []) as DataSourceKey[];
    let dataContext = '';

    if (dataSources.length > 0) {
      const adminDb = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );
      dataContext = await fetchDataContext(adminDb, user.id, dataSources);
    }

    const fullSystemPrompt = dataContext
      ? `${BASE_DIRECTIVE}\n\n${personaData.system_prompt}\n\n--- YOUR USER'S CURRENT DATA ---\n${dataContext}\n--- END DATA ---`
      : `${BASE_DIRECTIVE}\n\n${personaData.system_prompt}`;

    let sessionId = existingSessionId;
    let chatHistory: GeminiMessage[] = [];

    // Fetch existing chat history OR create a new session
    if (sessionId) {
      const { data: sessionData, error: sessionError } = await (await supabase)
        .from('language_coach_sessions')
        .select('messages')
        .eq('id', sessionId)
        .eq('user_id', user.id)
        .single();

      if (!sessionError && sessionData) {
        chatHistory = (sessionData.messages as GeminiMessage[]) || [];
      } else {
        sessionId = undefined;
      }
    }

    const userMessage: GeminiMessage = { role: 'user', parts: [{ text: message }] };
    chatHistory.push(userMessage);

    // Call the Gemini API
    const payload = {
      contents: chatHistory,
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
          messages: chatHistory as any
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
        .update({ messages: chatHistory as any })
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
