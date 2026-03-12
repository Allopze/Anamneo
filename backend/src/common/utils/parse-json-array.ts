/**
 * Safely parses a JSON string that is expected to be an array.
 * Returns an empty array if the value is falsy, not a valid JSON array, or parsing fails.
 */
export function parseJsonArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
