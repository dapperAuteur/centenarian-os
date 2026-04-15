// lib/academy/tour-types.ts
// TypeScript types for virtual tour data — shared between the player, the
// assembleTour helper, the scene editor (plan 23b), and the API routes.
// These shapes intentionally mirror the DB columns from migration 178 with
// one exception: at the API boundary, scenes carry their hotspots + links
// inline (assembled) rather than as separate lookup tables. The assembleTour
// helper in `./assembleTour.ts` performs that flattening.

export type HotspotType = 'info' | 'audio' | 'link' | 'scene_jump';

export interface TourHotspot {
  id: string;
  scene_id: string;
  hotspot_type: HotspotType;
  yaw: number;
  pitch: number;
  title: string;
  body: string | null;
  audio_url: string | null;
  external_url: string | null;
  target_scene_id: string | null;
  icon: string;
}

export interface TourSceneLink {
  id: string;
  from_scene_id: string;
  to_scene_id: string;
  yaw: number;
  pitch: number;
  label: string | null;
}

export interface TourScene {
  id: string;
  lesson_id: string;
  slug: string;
  name: string;
  caption: string | null;
  panorama_url: string;
  panorama_type: 'photo' | 'video';
  poster_url: string | null;
  start_yaw: number;
  start_pitch: number;
  is_entry_scene: boolean;
  order_index: number;
}

/** Flat row shapes as returned by the DB — used by assembleTour. */
export interface TourRawData {
  scenes: TourScene[];
  hotspots: TourHotspot[];
  links: TourSceneLink[];
}

/** Nested shape the player consumes: each scene has its hotspots + outgoing links inline. */
export interface AssembledTourScene extends TourScene {
  hotspots: TourHotspot[];
  outgoing_links: TourSceneLink[];
}

export interface AssembledTour {
  scenes: AssembledTourScene[];
  entry_scene_id: string | null;
}
