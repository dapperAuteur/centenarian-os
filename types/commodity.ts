// types/commodity.ts
// Better Vice Club commodity metadata for the /academy/explore map.
// 21 entries in lib/bvc/commodities.ts — one per episode.

export type Season = 1 | 2 | 3;

export interface Commodity {
  id: number;
  season: Season;
  ep: string;
  name: string;
  geo: string;
  lat: number;
  lon: number;
  body: string;
  isHome?: boolean;
}
