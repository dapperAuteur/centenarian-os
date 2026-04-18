// types/d3-topojson-shim.d.ts
// Minimal ambient declarations for d3, topojson-client, and
// topojson-specification so local typecheck passes before
// `npm install` pulls the real packages. Delete this file AFTER
// `@types/d3`, `@types/topojson-client`, and
// `@types/topojson-specification` are installed from the registry.
//
// Same pattern used for fuse.js during the school-network install
// gap — purely defensive, no runtime effect.

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace d3 {
  // Ambient namespace for type usages like d3.GeoPermissibleObjects.
  // Once real @types/d3 is installed, its own namespace declarations
  // will augment / supersede these shims.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type GeoPermissibleObjects = any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type ExtendedFeatureCollection = any;
}

declare module 'd3' {
  // Loose per-function types so `import * as d3 from "d3"` works
  // without flipping allowSyntheticDefaultImports.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function select(target: unknown): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function geoNaturalEarth1(): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function geoPath(proj?: unknown): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function geoGraticule(): any;
}

declare module 'topojson-client' {
  // Generic signature so `topojson.feature<T>(...)` accepts type args
  // like the real @types/topojson-client does.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function feature<T = any>(topology: unknown, object: unknown): T;
}

declare module 'topojson-specification' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export interface Topology<T = any> {
    type: 'Topology';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    objects: Record<string, any>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [k: string]: any;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export interface GeometryCollection<T = any> {
    type: 'GeometryCollection';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    geometries: any[];
  }
}
