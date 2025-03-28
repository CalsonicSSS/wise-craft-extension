/**
 * Generates a unique browser ID using crypto.randomUUID()
 * This ID will be used to identify users without requiring authentication
 */
export function generateBrowserId(): string {
  return crypto.randomUUID()
} 