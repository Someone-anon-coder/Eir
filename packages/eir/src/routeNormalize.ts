/**
 * Route normalization (Blueprint §7.3): dynamic path segments become
 * `:id` so `/plan/42/edit` and `/plan/57/edit` share one store bucket.
 * `overrides` is a plain function parameter, not a config-file surface —
 * `eir.config.ts`'s file-based loading is Phase 6's job; this just leaves
 * the seam open.
 */

const NUMERIC_SEGMENT = /^\d+$/;
const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface RouteOverride {
  readonly pattern: RegExp;
  readonly token: string;
}

export function normalizeRoute(pathname: string, overrides: readonly RouteOverride[] = []): string {
  const segments = pathname.split("/").map((segment) => {
    if (segment.length === 0) return segment;

    for (const override of overrides) {
      if (override.pattern.test(segment)) return override.token;
    }

    if (UUID_SEGMENT.test(segment) || NUMERIC_SEGMENT.test(segment)) return ":id";

    return segment;
  });

  return segments.join("/");
}
