export const CO2_PER_MILE: Record<string, number> = {
  plane: 0.255, car: 0.170, rideshare: 0.170, bus: 0.089,
  train: 0.041, ferry: 0.120, bike: 0, walk: 0, run: 0, other: 0,
};

export const HUMAN_POWERED = new Set(['bike', 'walk', 'run', 'other']);
