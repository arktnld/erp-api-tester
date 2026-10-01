/** {placeholders} of a template, in order, without duplicates. */
export function placeholdersIn(text: string): string[] {
  return [...new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))]
}
