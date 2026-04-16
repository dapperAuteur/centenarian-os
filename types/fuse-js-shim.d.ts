// Local module shim for fuse.js. The real package is in package.json at
// ^7.0.0 but couldn't be installed on the dev machine during plan 27b
// (school network intercepts registry.npmjs.org the same way it did
// during plan 23a). The shim lets `tsc` pass until `npm install` runs
// from a working network; once the real package lands its types take
// precedence and this file becomes dead code. Delete it then.

declare module 'fuse.js' {
  namespace Fuse {
    interface FuseResultMatch {
      indices: ReadonlyArray<[number, number]>;
      key?: string;
      value?: string;
    }

    interface FuseResult<T> {
      item: T;
      refIndex: number;
      score?: number;
      matches?: ReadonlyArray<FuseResultMatch>;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface IFuseOptions<T> {
      keys?: Array<string | { name: string; weight?: number }>;
      threshold?: number;
      ignoreLocation?: boolean;
      minMatchCharLength?: number;
      includeScore?: boolean;
      includeMatches?: boolean;
      shouldSort?: boolean;
    }
  }

  class Fuse<T> {
    constructor(list: ReadonlyArray<T>, options?: Fuse.IFuseOptions<T>);
    search(pattern: string): Fuse.FuseResult<T>[];
    setCollection(list: ReadonlyArray<T>): void;
  }

  export = Fuse;
}
