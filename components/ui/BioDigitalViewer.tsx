'use client';

// BioDigitalViewer.tsx
// Embeds the BioDigital Human 3D anatomy viewer via iframe.
// Requires NEXT_PUBLIC_BIODIGITAL_API_KEY in env (free personal tier available at developer.biodigital.com).
//
// Muscle highlight API:
//   After the iframe loads, send a postMessage to select anatomical structures by ID.
//   BioDigital IDs are their internal naming system — see BIODIGITAL_MUSCLE_IDS below.
//
// Docs: https://developer.biodigital.com/

import { useRef, useEffect, useState } from 'react';

// BioDigital anatomical structure IDs for common muscle groups.
// Obtain additional IDs from the BioDigital anatomy browser at human.biodigital.com.
export const BIODIGITAL_MUSCLE_IDS: Record<string, string[]> = {
  'chest':               ['pectoralis_major_clavicular_head', 'pectoralis_major_sternocostal_head'],
  'pectorals':           ['pectoralis_major_clavicular_head', 'pectoralis_major_sternocostal_head'],
  'anterior deltoid':    ['deltoid_anterior'],
  'medial deltoid':      ['deltoid_middle'],
  'posterior deltoid':   ['deltoid_posterior'],
  'shoulders':           ['deltoid_anterior', 'deltoid_middle', 'deltoid_posterior'],
  'biceps':              ['biceps_brachii_long_head', 'biceps_brachii_short_head'],
  'triceps':             ['triceps_brachii_lateral_head', 'triceps_brachii_long_head', 'triceps_brachii_medial_head'],
  'forearms':            ['brachioradialis', 'flexor_carpi_radialis'],
  'traps':               ['trapezius_ascending', 'trapezius_descending', 'trapezius_transverse'],
  'trapezius':           ['trapezius_ascending', 'trapezius_descending', 'trapezius_transverse'],
  'rhomboids':           ['rhomboid_major', 'rhomboid_minor'],
  'lats':                ['latissimus_dorsi'],
  'latissimus dorsi':    ['latissimus_dorsi'],
  'upper back':          ['trapezius_ascending', 'trapezius_descending', 'rhomboid_major'],
  'lower back':          ['erector_spinae'],
  'spinal erectors':     ['erector_spinae'],
  'core':                ['rectus_abdominis', 'transversus_abdominis'],
  'abs':                 ['rectus_abdominis'],
  'abdominals':          ['rectus_abdominis'],
  'obliques':            ['external_oblique', 'internal_oblique'],
  'glutes':              ['gluteus_maximus', 'gluteus_medius'],
  'hip flexors':         ['iliopsoas', 'rectus_femoris'],
  'quads':               ['rectus_femoris', 'vastus_lateralis', 'vastus_medialis'],
  'quadriceps':          ['rectus_femoris', 'vastus_lateralis', 'vastus_medialis'],
  'hamstrings':          ['biceps_femoris_long_head', 'semitendinosus', 'semimembranosus'],
  'calves':              ['gastrocnemius_lateral_head', 'gastrocnemius_medial_head', 'soleus'],
  'tibialis anterior':   ['tibialis_anterior'],
  'tibialis':            ['tibialis_anterior'],
  'neck':                ['sternocleidomastoid'],
};

function getMuscleIds(muscles: string[]): string[] {
  const ids = new Set<string>();
  for (const m of muscles) {
    const key = m.toLowerCase().trim();
    const found = BIODIGITAL_MUSCLE_IDS[key];
    if (found) found.forEach((id) => ids.add(id));
  }
  return Array.from(ids);
}

interface Props {
  muscles: string[];
  /** Optional: highlight a specific pre-built BioDigital scene. Defaults to male adult anatomy. */
  sceneId?: string;
  height?: string;
}

export default function BioDigitalViewer({
  muscles,
  sceneId = 'production/maleAdult',
  height = '500px',
}: Props) {
  const apiKey = process.env.NEXT_PUBLIC_BIODIGITAL_API_KEY;
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);
  const [noKey, setNoKey] = useState(false);

  useEffect(() => {
    if (!apiKey) {
      setNoKey(true);
      return;
    }
    setNoKey(false);
  }, [apiKey]);

  // Send highlight command when iframe signals it's ready
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== 'object') return;
      // BioDigital sends a 'load' event when the scene is ready
      if (e.data.type === 'scene.loaded' || e.data.type === 'load') {
        setIframeReady(true);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Highlight muscles whenever ready or muscle list changes
  useEffect(() => {
    if (!iframeReady || !iframeRef.current?.contentWindow) return;
    const ids = getMuscleIds(muscles);
    if (ids.length === 0) return;

    try {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'scene.select',
          targets: ids.map((id) => ({ id, color: '#d946ef' })),
        },
        'https://human.biodigital.com',
      );
    } catch {
      // postMessage may fail if iframe hasn't fully loaded
    }
  }, [iframeReady, muscles]);

  if (noKey) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 bg-gray-50 border border-dashed border-gray-300 rounded-xl p-8 text-center">
        <p className="text-sm font-medium text-gray-600">BioDigital 3D Viewer</p>
        <p className="text-xs text-gray-400 max-w-sm">
          Add <code className="bg-gray-100 px-1 rounded text-gray-700">NEXT_PUBLIC_BIODIGITAL_API_KEY</code> to your{' '}
          <code className="bg-gray-100 px-1 rounded text-gray-700">.env.local</code> to enable this.
          Get a free personal API key at{' '}
          <a href="https://developer.biodigital.com" target="_blank" rel="noopener noreferrer" className="text-sky-600 hover:underline">
            developer.biodigital.com
          </a>.
        </p>
      </div>
    );
  }

  const src = `https://human.biodigital.com/widget/?id=${encodeURIComponent(sceneId)}&dk=${encodeURIComponent(apiKey!)}&ui-anatomy-descriptions=true&ui-anatomy-labels=true&ui-panel-appearance=false`;

  return (
    <div className="rounded-xl overflow-hidden border border-gray-200 bg-gray-900" style={{ height }}>
      <iframe
        ref={iframeRef}
        src={src}
        width="100%"
        height="100%"
        title="BioDigital Human 3D Anatomy Viewer"
        allow="fullscreen"
        onLoad={() => setIframeReady(true)}
        className="border-0"
      />
    </div>
  );
}
