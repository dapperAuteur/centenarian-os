// Local module shims for Photo Sphere Viewer plugins that plan 23 depends
// on but couldn't be installed on the dev machine during plan 23a (the
// network routes through a Lightspeed school filter that blocks
// registry.npmjs.org). The real packages must be installed before the
// code actually runs — these shims only exist so `tsc` doesn't fail the
// build while the package manager can't reach the registry.
//
// Install on a working network:
//   npm install @photo-sphere-viewer/markers-plugin @photo-sphere-viewer/virtual-tour-plugin
//
// Once installed the real package types take precedence and these shims
// become dead code. Keep the file around until we're confident every
// dev machine has the plugins; then delete it in a small chore branch.

declare module '@photo-sphere-viewer/virtual-tour-plugin' {
  // The plugin's config and nodes are opaque to us at the TS layer because
  // we only consume them through the `plugins: [[Plugin, config]]` array
  // which the PSV Viewer constructor accepts as `any`-ish already.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const VirtualTourPlugin: any;
}

declare module '@photo-sphere-viewer/markers-plugin' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const MarkersPlugin: any;
}

declare module '@photo-sphere-viewer/virtual-tour-plugin/index.css';
declare module '@photo-sphere-viewer/markers-plugin/index.css';
