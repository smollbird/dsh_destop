/**
 * Ambient type shim for `react` / `react/jsx-runtime` and the JSX namespace.
 *
 * The web shell bundles React into the client module table, but the desktop
 * app's node_modules has no @types/react (React lives inside the
 * dsh-web-frontend bundle). These minimal declarations are enough to type
 * the tab components; the runtime values come from the loader's static
 * module table via the wrap-time `require("react")` rewrite.
 *
 * Script file on purpose (no import/export): `declare module` blocks here are
 * true ambient module declarations, and the JSX namespace lands on global.
 */
declare module "react" {
  export interface ReactElement {
    readonly type: unknown;
    readonly props: unknown;
    readonly key: string | null;
  }
  export type ReactNode = ReactElement | string | number | boolean | null | undefined | ReactNode[];

  export function useState<S>(initial: S | (() => S)): [S, (value: S | ((previous: S) => S)) => void];
  export function useEffect(effect: () => void | (() => void), deps?: readonly unknown[]): void;
  export function useMemo<T>(factory: () => T, deps: readonly unknown[]): T;
  export function useRef<T>(initial: T): { current: T };
}

declare module "react/jsx-runtime" {
  export const jsx: (type: unknown, props: unknown, key?: unknown) => unknown;
  export const jsxs: (type: unknown, props: unknown, key?: unknown) => unknown;
  export const Fragment: unknown;
}

declare namespace JSX {
  interface Element {
    readonly type: unknown;
    readonly props: unknown;
    readonly key: string | null;
  }
  interface IntrinsicElements {
    [elem: string]: any;
  }
}
