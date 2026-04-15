// lib/academy/assembleTour.ts
// Pure function that takes the flat scenes/hotspots/links rows returned by
// the tour GET API and reshapes them into the nested form the player
// consumes: each scene has its hotspots and outgoing links inline, and the
// tour knows which scene is the entry point.
//
// Pure function, no side effects — easily unit-testable.

import type {
  TourRawData,
  AssembledTour,
  AssembledTourScene,
} from './tour-types';

export function assembleTour(raw: TourRawData): AssembledTour {
  const scenesById = new Map<string, AssembledTourScene>();

  // Sort scenes by order_index so the player sees them in author order
  const sortedScenes = [...raw.scenes].sort((a, b) => a.order_index - b.order_index);

  for (const scene of sortedScenes) {
    scenesById.set(scene.id, {
      ...scene,
      hotspots: [],
      outgoing_links: [],
    });
  }

  for (const hotspot of raw.hotspots) {
    const scene = scenesById.get(hotspot.scene_id);
    if (scene) scene.hotspots.push(hotspot);
  }

  for (const link of raw.links) {
    const scene = scenesById.get(link.from_scene_id);
    if (scene) scene.outgoing_links.push(link);
  }

  const scenes = sortedScenes.map((s) => scenesById.get(s.id)!).filter(Boolean);
  const entryScene = scenes.find((s) => s.is_entry_scene) ?? scenes[0] ?? null;

  return {
    scenes,
    entry_scene_id: entryScene ? entryScene.id : null,
  };
}
