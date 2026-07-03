export function extractAnnotations(stdout: string): string {
  const cleaned = stripTerminalSequences(stdout)
    .replace(/\r/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

  const content = cleaned
    .split("\n")
    .filter((line) => !isLumenStatusLine(line.trim()))
    .join("\n")
    .trim();

  if (!content) return "";

  return content
    .split(/\n\s*---\s*\n/)
    .map((block) => block.trim())
    .filter(hasAnnotationLocation)
    .join("\n---\n")
    .trim();
}

function stripTerminalSequences(text: string): string {
  return text
    .replace(/\u001B\][^\u0007]*(?:\u0007|\u001B\\)/g, "")
    .replace(/\u001B\[[0-?]*[ -/]*[@-~]/g, "");
}

function isLumenStatusLine(line: string): boolean {
  return /^[⠋⠙⠹⠸⠼⠴⠦⠧✓]\s+(?:Fetching|Fetched|Syncing|\d+ files? marked as viewed\b)/.test(line);
}

function hasAnnotationLocation(block: string): boolean {
  return block
    .split("\n")
    .some((line) => /^\s*(?:\*\*)?.+?(?:\*\*)?\s+line\s+\d+\s+\((?:LEFT|RIGHT)\)\s*$/i.test(line));
}

export function countAnnotations(stdout: string): number {
  const trimmed = stdout.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\n---\n/).filter(hasAnnotationLocation).length;
}
