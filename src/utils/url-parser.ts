import type { QueryEntry } from "../domain/request";
export function parseQuery(url: string): QueryEntry[] {
  try { return [...new URL(url).searchParams.entries()].map(([name, value]) => ({ name, value })); }
  catch { return []; }
}
