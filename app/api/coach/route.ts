/* eslint-disable @typescript-eslint/no-explicit-any */
// File: app/api/coach/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { GeminiMessage } from '@/lib/types'; // Import from our main types file
import { createClient as createAdminClient } from '@supabase/supabase-js';

// The Gemini API model to use
const GEMINI_MODEL = 'gemini-2.5-flash';

/**
 * Define the structure of the request body from the client
 */
interface CoachRequestBody {
  message: string;
  gemPersonaId: string;
  sessionId?: string; // Optional: to continue an existing session
}

/**
 * Define the structure for a parsed flashcard
 */
interface ParsedFlashcard {
  front: string;
  back: string;
}

/**
 * ====================================================================
 * Main API Route Handler (POST /api/coach)
 * ====================================================================
 */
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

    // 1. Get the Google Gemini API key from environment variables
    //    REMINDER: You must set this in your .env.local file and Vercel environment.
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error('GOOGLE_GEMINI_API_KEY is not set');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    // 2. Fetch the Gem Persona's system prompt
    const { data: personaData, error: personaError } = await (await supabase)
      .from('gem_personas')
      .select('system_prompt')
      .eq('id', gemPersonaId)
      .eq('user_id', user.id)
      .single();

    if (personaError || !personaData) {
      console.error('Error fetching persona:', personaError);
      return NextResponse.json({ error: 'Could not find Gem Persona' }, { status: 404 });
    }

    const systemPrompt = personaData.system_prompt;
    let sessionId = existingSessionId;
    let chatHistory: GeminiMessage[] = [];

    // 3. Fetch existing chat history OR create a new session
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
        // Session ID was provided but not found; create a new one
        sessionId = undefined;
      }
    }
    
    // Add the new user message to the history
    const userMessage: GeminiMessage = { role: 'user', parts: [{ text: message }] };
    chatHistory.push(userMessage);

    // 4. Call the Gemini API
    const payload = {
      contents: chatHistory,
      systemInstruction: {
        parts: [{ text: systemPrompt }]
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

    // 5. Add model response to chat history
    const modelMessage: GeminiMessage = { role: 'model', parts: [{ text: modelResponseText }] };
    chatHistory.push(modelMessage);

    // 6. Save the updated chat history to Supabase
    if (!sessionId) {
      // Create a new session
      const { data: newSession, error: newSessionError } = await (await supabase)
        .from('language_coach_sessions')
        .insert({
          user_id: user.id,
          gem_persona_id: gemPersonaId,
          messages: chatHistory as any // Cast to 'any' or use correct Json type
        })
        .select('id')
        .single();
      
      if (newSessionError) {
        console.error('Error creating new chat session:', newSessionError);
        // Continue anyway, just return the response
      } else {
        sessionId = newSession.id; // Get the ID for the next request
      }
    } else {
      // Update existing session
      const { error: updateError } = await (await supabase)
        .from('language_coach_sessions')
        .update({ messages: chatHistory as any }) // Cast to 'any' or use correct Json type
        .eq('id', sessionId)
        .eq('user_id', user.id);
      
      if (updateError) {
        console.error('Error updating chat session:', updateError);
        // Continue anyway
      }
    }

    // 7. Process Flashcards (Async - don't make the user wait)
    // We call this function but don't `await` it.
    // It will run in the background.
    processFlashcards(modelResponseText, user.id, gemPersonaId)
      .catch(err => console.error('Background flashcard processing failed:', err));

    // 8. Return the response to the client
    return NextResponse.json({ 
      message: modelResponseText, 
      sessionId: sessionId // Return the session ID
    });

  } catch (error) {
    console.error('Error in /api/coach:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * ====================================================================
 * Background Flashcard Processor
 * ====================================================================
 * This function runs asynchronously and does not block the API response.
 * It parses the AI's response, creates flashcards, and saves them to the DB.
 */
async function processFlashcards(responseText: string, userId: string, gemPersonaId: string) {
  // Use a regex to find all flashcard blocks in the response
  const flashcardBlockRegex = /\[START_FLASHCARDS\]([\s\S]*?)\[END_FLASHCARDS\]/g;
  const flashcardRegex = /F::(.*?)\nB::(.*?)(?=\nF::|\n*$)/g; // Removed 's' flag
  
  // **FIX for IDE WARNING:**
  // Explicitly import and use the admin client from '@supabase/supabase-js'
  // to avoid conflicts with the client-side `createClient` from '@supabase/ssr'.
  // This client requires the Service Role Key, which is safe on the server.
  const supabase = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service key for background tasks
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

      // 1. Create a new Flashcard Set
      // We'll need to fetch the persona language (e.g., "Spanish")
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
        continue; // Skip this block
      }

      // 2. Create the individual flashcards
      const cardsToInsert = flashcards.map(card => ({
        set_id: set.id,
        user_id: userId,
        front_text: card.front,
        back_text: card.back,
      }));

      const { data: newCards, error: cardsError } = await supabase
        .from('flashcards')
        .insert(cardsToInsert)
        .select('id'); // Select the IDs of the newly inserted cards
      
      if (cardsError || !newCards) {
        console.error('Error inserting flashcards:', cardsError);
      } else {
        console.log(`Successfully inserted ${newCards.length} cards.`);
        
        // 3. Create analytics stubs for each card
        const analyticsToInsert = newCards.map(card => ({
          card_id: card.id,
          user_id: userId,
          status: 'new', // As defined in our schema
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
