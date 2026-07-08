/**
 * Exhaustiveness guard: a discriminated union handled by a `switch` with a
 * `default: assertNever(x)` branch fails to *compile* if a new case is
 * added to the union without a matching arm — not a silent runtime
 * fallthrough. See the triage dispatch in `matcher.ts` for the real use.
 */
export function assertNever(x: never): never {
  throw new Error(`Unreachable case: ${JSON.stringify(x)}`);
}
