// lib/cloudinary/poster.ts
// Derive a flat 2D poster image URL from a Cloudinary upload URL for 360°
// equirectangular media. Used to populate lessons.video_360_poster_url.
//
// For videos: injects a `so_0,w_1280,h_640,c_fill` transformation and swaps
//   the extension to .jpg. Cloudinary serves the first frame as a static
//   JPEG at 1280x640 (standard equirectangular aspect ratio).
// For images: injects `w_1280,h_640,c_fill` and keeps the extension.
//
// If the input URL doesn't match the expected Cloudinary shape, returns
// null and lets the caller decide what to do (usually: skip the poster).

const POSTER_WIDTH = 1280;
const POSTER_HEIGHT = 640;

/**
 * Insert a Cloudinary transformation into an upload URL.
 * Example inputs:
 *   https://res.cloudinary.com/<cloud>/video/upload/v1234/academy/360-videos/abc.mp4
 *   https://res.cloudinary.com/<cloud>/image/upload/v1234/academy/360-photos/abc.jpg
 * Example outputs:
 *   https://res.cloudinary.com/<cloud>/video/upload/so_0,w_1280,h_640,c_fill/v1234/academy/360-videos/abc.jpg
 *   https://res.cloudinary.com/<cloud>/image/upload/w_1280,h_640,c_fill/v1234/academy/360-photos/abc.jpg
 */
export function derivePosterUrl(
  secureUrl: string,
  resourceType: 'video' | 'image',
): string | null {
  if (!secureUrl) return null;

  // Guard: must be a Cloudinary upload URL. External URLs pasted by the
  // teacher return null and the caller falls back to no poster.
  const uploadMarker = '/upload/';
  const uploadIndex = secureUrl.indexOf(uploadMarker);
  if (uploadIndex === -1) return null;

  const prefix = secureUrl.slice(0, uploadIndex + uploadMarker.length);
  const rest = secureUrl.slice(uploadIndex + uploadMarker.length);

  const transform = resourceType === 'video'
    ? `so_0,w_${POSTER_WIDTH},h_${POSTER_HEIGHT},c_fill/`
    : `w_${POSTER_WIDTH},h_${POSTER_HEIGHT},c_fill/`;

  // Rewrite extension to .jpg for videos. For images, keep the original
  // extension so PNGs stay PNGs — Cloudinary still resizes them.
  const withTransform = prefix + transform + rest;
  if (resourceType === 'video') {
    return withTransform.replace(/\.(mp4|mov|webm|mkv|insv|m4v)(\?.*)?$/i, '.jpg$2');
  }
  return withTransform;
}
