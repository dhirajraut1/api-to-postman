// Reserved for splitting message validation/routing from service-worker.ts as the project grows.
export function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
