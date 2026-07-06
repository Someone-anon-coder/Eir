/**
 * Structural key material for a wrapped locator's identity. Populated on
 * every capture point in Phase 2; not read or acted on until Phase 3, which
 * keys the fingerprint store off it.
 */

export const CAPTURE_POINT_METHODS = [
  "locator",
  "getByRole",
  "getByLabel",
  "getByText",
  "getByTestId",
  "getByPlaceholder",
] as const;

export type CapturePointMethod = (typeof CAPTURE_POINT_METHODS)[number];

export interface ChainHop {
  readonly method: CapturePointMethod;
  readonly args: readonly unknown[];
}

export interface SelectorIdentity {
  readonly rawSelector: string;
  readonly chainPath: readonly ChainHop[];
  readonly routeAtCreation: string;
}

export function routeFromUrl(url: string): string {
  return new URL(url).pathname;
}

export function extendChain(
  parentChainPath: readonly ChainHop[],
  method: CapturePointMethod,
  args: readonly unknown[],
): readonly ChainHop[] {
  return [...parentChainPath, { method, args }];
}
