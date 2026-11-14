/** How many characters before a match are searched for context words. */
export const CONTEXT_WINDOW = 40;
/** Confidence added when a context word is found. */
export const CONTEXT_BOOST = 0.35;

/**
 * True if any of `words` appears in the CONTEXT_WINDOW characters before `start`.
 * Words are matched case-insensitively on word boundaries, so "nic" does not match "clinic".
 */
export function hasContextBefore(text: string, start: number, words: string[]): boolean {
  if (words.length === 0) return false;
  const before = text.slice(Math.max(0, start - CONTEXT_WINDOW), start).toLowerCase();
  return words.some((w) => {
    const word = w.toLowerCase();
    let i = before.indexOf(word);
    while (i !== -1) {
      const prev = before[i - 1];
      const next = before[i + word.length];
      if (!isWordChar(prev) && !isWordChar(next)) return true;
      i = before.indexOf(word, i + 1);
    }
    return false;
  });
}

function isWordChar(c: string | undefined): boolean {
  return c !== undefined && /[\p{L}\p{N}_]/u.test(c);
}
