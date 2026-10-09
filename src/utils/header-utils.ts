import type { HeaderEntry } from "../domain/request";
export function findHeader(headers: HeaderEntry[], name: string): HeaderEntry[] {
  return headers.filter(header => header.name.toLowerCase() === name.toLowerCase());
}
