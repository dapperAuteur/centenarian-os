// lib/academy/camera-filename.ts
// Map common 360° camera filenames to a human-readable lesson title
// suggestion. Consumer 360° cameras use predictable filename patterns:
//   - Insta360 X/ONE X series: VID_YYYYMMDD_HHMMSS_XX_XXX.{insv,mp4}
//   - Insta360 photos:         IMG_YYYYMMDD_HHMMSS_XX.{insp,jpg}
//   - GoPro Max:               GS{6 digits}.360 / GS{6 digits}.mp4
//   - Ricoh Theta:             R00{4-5 digits}.{mp4,jpg} or {YYMMDDhhmmss}.mp4
//
// The patterns are advisory only. If nothing matches, we return null and
// the caller should fall back to whatever it was doing (the teacher's
// existing title, or a generic default).

interface SuggestionInput {
  /** Filename WITHOUT extension (Cloudinary returns it as `original_filename`). */
  originalFilename: string | null | undefined;
}

interface Suggestion {
  title: string;
  /** Which camera pattern matched — handy for telemetry. */
  cameraHint: 'insta360_video' | 'insta360_photo' | 'gopro_max' | 'ricoh_theta';
}

// --- regexes ---------------------------------------------------------------

// Insta360 video: VID_20260411_143022_00_012 (+/- the trailing XX_XXX segments)
const INSTA360_VIDEO = /^VID_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/i;

// Insta360 photo: IMG_20260411_143022_00 (allow with or without trailing segments)
const INSTA360_PHOTO = /^IMG_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/i;

// GoPro Max: GS012345 (6 digits) — no date in filename, use upload date
const GOPRO_MAX = /^GS\d{6}$/i;

// Ricoh Theta (new style): R0012345 — 4-7 digits
// Ricoh Theta (old style, with date): e.g. 260411143022 (12-digit yymmddhhmmss)
const RICOH_NUMERIC = /^R\d{4,7}$/i;
const RICOH_DATE = /^(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/;

// --- helpers ---------------------------------------------------------------

function formatDate(y: number, m: number, d: number, hh: number, mm: number): string {
  const date = new Date(y, m - 1, d, hh, mm);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// --- public ----------------------------------------------------------------

export function suggestTitleFromFilename({ originalFilename }: SuggestionInput): Suggestion | null {
  if (!originalFilename) return null;
  // Cloudinary's `original_filename` strips the extension already, but be
  // defensive in case a caller passes the full filename.
  const base = originalFilename.replace(/\.[^.]+$/, '').trim();
  if (!base) return null;

  const videoMatch = base.match(INSTA360_VIDEO);
  if (videoMatch) {
    const [, y, m, d, hh, mm] = videoMatch;
    const stamp = formatDate(+y, +m, +d, +hh, +mm);
    return { title: stamp ? `Insta360 recording — ${stamp}` : 'Insta360 recording', cameraHint: 'insta360_video' };
  }

  const photoMatch = base.match(INSTA360_PHOTO);
  if (photoMatch) {
    const [, y, m, d, hh, mm] = photoMatch;
    const stamp = formatDate(+y, +m, +d, +hh, +mm);
    return { title: stamp ? `Insta360 photo — ${stamp}` : 'Insta360 photo', cameraHint: 'insta360_photo' };
  }

  if (GOPRO_MAX.test(base)) {
    return { title: 'GoPro Max recording', cameraHint: 'gopro_max' };
  }

  if (RICOH_NUMERIC.test(base)) {
    return { title: 'Ricoh Theta recording', cameraHint: 'ricoh_theta' };
  }

  const ricohDateMatch = base.match(RICOH_DATE);
  if (ricohDateMatch) {
    const [, yy, m, d, hh, mm] = ricohDateMatch;
    // yymmddhhmmss — assume 20YY
    const stamp = formatDate(2000 + +yy, +m, +d, +hh, +mm);
    return {
      title: stamp ? `Ricoh Theta — ${stamp}` : 'Ricoh Theta recording',
      cameraHint: 'ricoh_theta',
    };
  }

  return null;
}

/**
 * Check whether an upload's dimensions look like equirectangular (2:1
 * aspect ratio). Returns null when we don't have enough data, 'ok' when
 * it looks right, 'suspect' when it doesn't. Don't treat 'suspect' as
 * a hard reject — some cameras produce 16:9 stitched previews or
 * half-sphere (180°) files which are legitimately not 2:1 but still
 * usable. Surface the warning and let the teacher decide.
 */
export function checkEquirectangularRatio(width?: number | null, height?: number | null): 'ok' | 'suspect' | null {
  if (!width || !height || width <= 0 || height <= 0) return null;
  const ratio = width / height;
  if (ratio >= 1.95 && ratio <= 2.05) return 'ok';
  return 'suspect';
}
