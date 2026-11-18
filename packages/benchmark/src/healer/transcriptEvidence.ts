/**
 * Reads a healer transcript (stream-json) for what the healer saw. Used to
 * check the destructive-debugging hypothesis: did the healer's first page
 * evidence already lack the row its original spec was about?
 */

type Json = Record<string, unknown>;
const isRecord = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** Every tool result's text, in order. */
export function toolResultTexts(jsonl: string): string[] {
  const out: string[] = [];
  for (const line of jsonl.split("\n")) {
    if (line.trim() === "") continue;
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (!isRecord(event) || event["type"] !== "user" || !isRecord(event["message"])) continue;
    const content = event["message"]["content"];
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (isRecord(block) && block["type"] === "tool_result") {
        out.push(
          typeof block["content"] === "string"
            ? block["content"]
            : JSON.stringify(block["content"]),
        );
      }
    }
  }
  return out;
}

export type RowEvidence = "present" | "missing" | "no-evidence";

/**
 * In the first tool result that shows the Active Devices table, is the row for
 * `owner` (or `device`) there? `no-evidence` when no result shows that table.
 */
export function firstActiveTableEvidence(
  results: readonly string[],
  owner: string,
  device: string,
): RowEvidence {
  for (const raw of results) {
    const text = raw.replace(/\\n/g, "\n");
    const start = text.indexOf("Active Devices");
    if (start === -1) continue;
    const end = text.indexOf("Archived Devices", start);
    const section = end === -1 ? text.slice(start) : text.slice(start, end);
    return section.includes(owner) || section.includes(device) ? "present" : "missing";
  }
  return "no-evidence";
}

/** The first assistant sentence mentioning the archived table: what the healer said it concluded. */
export function firstArchivedClaim(jsonl: string): string | undefined {
  for (const line of jsonl.split("\n")) {
    if (line.trim() === "") continue;
    let event: unknown;
    try {
      event = JSON.parse(line);
    } catch {
      continue;
    }
    if (!isRecord(event) || event["type"] !== "assistant" || !isRecord(event["message"])) continue;
    const content = event["message"]["content"];
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (
        isRecord(block) &&
        block["type"] === "text" &&
        typeof block["text"] === "string" &&
        /archived/i.test(block["text"])
      ) {
        return block["text"].replace(/\s+/g, " ").trim().slice(0, 260);
      }
    }
  }
  return undefined;
}
