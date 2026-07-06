/**
 * Forwards an overloaded or generic Playwright method whose full call-
 * signature set can't be captured by `Parameters<>`/`ReturnType<>` (those
 * utility types only see a method's last declared overload — confirmed by
 * `tsc` rejecting the naive derivation for `on`/`off`/`evaluate`/etc., each
 * with up to 19 per-event-name overloads). The cast is narrow, applies only
 * to the named members using it, and is approved for this pattern (see
 * NOTES.md RISK-003 for the sibling private-internals cast this mirrors).
 */
export function forwardOverloaded<T>(call: (...args: unknown[]) => unknown): T {
  return call as unknown as T;
}
