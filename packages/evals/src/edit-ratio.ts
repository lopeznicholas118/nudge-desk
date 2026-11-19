/** Levenshtein distance by UTF-16 code unit. O(n·m) time, O(min(n, m)) memory. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length < b.length) [a, b] = [b, a]; // keep the shorter string as the inner dimension
  let previous = Array.from({length: b.length + 1}, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
    }
    previous = current;
  }
  return previous[b.length]!;
}

/** 0 means untouched, 1 means completely rewritten. */
export function editRatio(original: string, final: string): number {
  const longest = Math.max(original.length, final.length);
  return longest === 0 ? 0 : editDistance(original, final) / longest;
}