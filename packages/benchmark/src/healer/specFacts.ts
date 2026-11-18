import ts from "typescript";

/**
 * Static facts about a spec, read with the TypeScript compiler API (not
 * regexes: the healer rewrites formatting, quote style and variable names
 * freely, and none of that may look like tampering).
 */

export interface AssertionFact {
  readonly matcher: string;
  readonly negated: boolean;
  readonly soft: boolean;
  /** Normalized argument text. The receiver is deliberately absent: a locator fix changes it legitimately. */
  readonly args: readonly string[];
}

export interface SpecFacts {
  readonly assertions: readonly AssertionFact[];
  readonly forceTrueCount: number;
  readonly tryStatementCount: number;
  /** Every explicit numeric `timeout` option / `setTimeout` argument, in ms. */
  readonly timeouts: readonly number[];
  /** `test.fixme(...)` / `test.skip(...)` present. */
  readonly markedFixme: boolean;
  /** `test.fail(...)` inverts the pass condition. */
  readonly markedFail: boolean;
  /** Receivers of action calls (click, fill, ...) in source order, with one level of `const` resolved. */
  readonly actionLocators: readonly string[];
  /** All comment texts, trimmed. */
  readonly comments: readonly string[];
}

const ACTIONS: ReadonlySet<string> = new Set([
  "click",
  "dblclick",
  "fill",
  "clear",
  "check",
  "uncheck",
  "selectOption",
  "press",
  "pressSequentially",
  "type",
  "hover",
  "tap",
  "focus",
  "setInputFiles",
]);

/** Single-quoted and double-quoted literals compare equal; whitespace is collapsed. */
export function normalizeText(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .replace(/'((?:[^'\\]|\\.)*)'/g, (_m, inner: string) =>
      JSON.stringify(inner.replace(/\\'/g, "'")),
    )
    .replace(/;$/, "")
    .trim();
}

function textOf(node: ts.Node, source: ts.SourceFile): string {
  return normalizeText(node.getText(source));
}

function unwrap(expr: ts.Expression): ts.Expression {
  let current = expr;
  while (
    ts.isAwaitExpression(current) ||
    ts.isParenthesizedExpression(current) ||
    ts.isNonNullExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

/** Collects `const name = <init>` declarations for one-level receiver resolution. */
function collectConsts(source: ts.SourceFile): Map<string, ts.Expression> {
  const consts = new Map<string, ts.Expression>();
  const visit = (node: ts.Node): void => {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined
    ) {
      consts.set(node.name.text, unwrap(node.initializer));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return consts;
}

function rootIdentifier(expr: ts.Expression): ts.Identifier | undefined {
  let current = unwrap(expr);
  for (;;) {
    if (ts.isIdentifier(current)) return current;
    if (ts.isPropertyAccessExpression(current)) current = unwrap(current.expression);
    else if (ts.isCallExpression(current)) current = unwrap(current.expression);
    else if (ts.isElementAccessExpression(current)) current = unwrap(current.expression);
    else return undefined;
  }
}

function resolveReceiver(
  expr: ts.Expression,
  consts: ReadonlyMap<string, ts.Expression>,
  source: ts.SourceFile,
  depth = 0,
): string {
  const text = textOf(expr, source);
  const root = rootIdentifier(expr);
  if (root === undefined || depth >= 3) return text;
  const init = consts.get(root.text);
  if (init === undefined || root.text === "page") return text;
  const rest = text.slice(root.text.length);
  return resolveReceiver(init, consts, source, depth + 1) + rest;
}

function numericValue(node: ts.Expression): number | undefined {
  const inner = unwrap(node);
  if (ts.isNumericLiteral(inner)) return Number(inner.text);
  if (ts.isPrefixUnaryExpression(inner) && inner.operator === ts.SyntaxKind.MinusToken) {
    const value = numericValue(inner.operand);
    return value === undefined ? undefined : -value;
  }
  // `10 * 1000` style durations.
  if (ts.isBinaryExpression(inner) && inner.operatorToken.kind === ts.SyntaxKind.AsteriskToken) {
    const left = numericValue(inner.left);
    const right = numericValue(inner.right);
    return left !== undefined && right !== undefined ? left * right : undefined;
  }
  return undefined;
}

function propertyNameText(name: ts.PropertyName): string | undefined {
  return ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined;
}

/** `expect(x).not.toHaveValue(...)`, `expect.soft(x).toBe(...)`, `await expect(...)...` */
function asAssertion(call: ts.CallExpression, source: ts.SourceFile): AssertionFact | undefined {
  const callee = call.expression;
  if (!ts.isPropertyAccessExpression(callee)) return undefined;
  const matcher = callee.name.text;
  let target: ts.Expression = unwrap(callee.expression);
  let negated = false;
  // Walk `.not` / `.resolves` / `.rejects` modifiers down to the `expect(...)` call.
  while (ts.isPropertyAccessExpression(target)) {
    if (target.name.text === "not") negated = !negated;
    target = unwrap(target.expression);
  }
  if (!ts.isCallExpression(target)) return undefined;
  const head = target.expression;
  const isExpect = ts.isIdentifier(head) && head.text === "expect";
  const isSoft =
    ts.isPropertyAccessExpression(head) &&
    ts.isIdentifier(head.expression) &&
    head.expression.text === "expect" &&
    head.name.text === "soft";
  const isPoll =
    ts.isPropertyAccessExpression(head) &&
    ts.isIdentifier(head.expression) &&
    head.expression.text === "expect" &&
    head.name.text === "poll";
  if (!isExpect && !isSoft && !isPoll) return undefined;
  return { matcher, negated, soft: isSoft, args: call.arguments.map((arg) => textOf(arg, source)) };
}

export function extractSpecFacts(text: string): SpecFacts {
  const source = ts.createSourceFile(
    "spec.ts",
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const consts = collectConsts(source);
  const assertions: AssertionFact[] = [];
  const timeouts: number[] = [];
  const actionLocators: string[] = [];
  let forceTrueCount = 0;
  let tryStatementCount = 0;
  let markedFixme = false;
  let markedFail = false;

  const visit = (node: ts.Node): void => {
    if (ts.isTryStatement(node)) tryStatementCount++;

    if (ts.isPropertyAssignment(node)) {
      const name = propertyNameText(node.name);
      if (name === "force" && unwrap(node.initializer).kind === ts.SyntaxKind.TrueKeyword)
        forceTrueCount++;
      if (name === "timeout") {
        const value = numericValue(node.initializer);
        if (value !== undefined) timeouts.push(value);
      }
    }
    if (ts.isShorthandPropertyAssignment(node) && node.name.text === "force") forceTrueCount++;

    if (ts.isCallExpression(node)) {
      const assertion = asAssertion(node, source);
      if (assertion !== undefined) assertions.push(assertion);

      const callee = node.expression;
      if (ts.isPropertyAccessExpression(callee)) {
        const method = callee.name.text;
        const owner = ts.isIdentifier(callee.expression) ? callee.expression.text : undefined;
        if (owner === "test" && (method === "fixme" || method === "skip")) markedFixme = true;
        if (owner === "test" && method === "fail") markedFail = true;
        if (owner === "test" && method === "setTimeout") {
          const value =
            node.arguments[0] === undefined ? undefined : numericValue(node.arguments[0]);
          if (value !== undefined) timeouts.push(value);
        }
        if (ACTIONS.has(method)) {
          actionLocators.push(resolveReceiver(callee.expression, consts, source));
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  const comments: string[] = [];
  const seen = new Set<number>();
  const scan = (node: ts.Node): void => {
    for (const range of [
      ...(ts.getLeadingCommentRanges(text, node.getFullStart()) ?? []),
      ...(ts.getTrailingCommentRanges(text, node.getEnd()) ?? []),
    ]) {
      if (seen.has(range.pos)) continue;
      seen.add(range.pos);
      comments.push(
        text
          .slice(range.pos, range.end)
          .replace(/^\/\/|^\/\*|\*\/$/g, "")
          .trim(),
      );
    }
    ts.forEachChild(node, scan);
  };
  scan(source);

  return {
    assertions,
    forceTrueCount,
    tryStatementCount,
    timeouts,
    markedFixme,
    markedFail,
    actionLocators,
    comments,
  };
}
