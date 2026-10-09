import type { CapturedRequest } from "./request";

export interface EnvironmentProfile {
  id: string;
  name: string;
  baseUrl: string;
  authToken: string;
  variables?: Record<string, string>;
}

export interface VariableMappingConfig {
  enabled: boolean;
  baseUrlVar: string;
  baseUrlValue: string;
  authTokenVar: string;
  authTokenValue: string;
  bearerPrefix: boolean;
  environments: EnvironmentProfile[];
  activeEnvironmentId: string;
}

export const DEFAULT_ENVIRONMENTS: EnvironmentProfile[] = [
  { id: "dev", name: "Development", baseUrl: "https://dev-api.example.com", authToken: "" },
  { id: "staging", name: "Staging", baseUrl: "https://staging-api.example.com", authToken: "" },
  { id: "prod", name: "Production", baseUrl: "https://api.example.com", authToken: "" }
];

export const DEFAULT_VARIABLE_CONFIG: VariableMappingConfig = {
  enabled: true,
  baseUrlVar: "baseUrl",
  baseUrlValue: "",
  authTokenVar: "authToken",
  authTokenValue: "",
  bearerPrefix: true,
  environments: DEFAULT_ENVIRONMENTS,
  activeEnvironmentId: "dev"
};

/**
 * Detects unique origins from captured requests and sorts them by frequency of appearance.
 */
export function detectBaseUrls(requests: CapturedRequest[]): string[] {
  const counts = new Map<string, number>();
  for (const req of requests) {
    try {
      const url = new URL(req.url);
      const origin = url.origin;
      if (origin && origin !== "null") {
        counts.set(origin, (counts.get(origin) ?? 0) + 1);
      }
    } catch {
      // Ignore invalid URL strings
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([origin]) => origin);
}

/**
 * Detects authorization tokens or API keys from request headers.
 */
export function detectAuthToken(requests: CapturedRequest[]): {
  headerName: string;
  rawValue: string;
  tokenValue: string;
  hasBearer: boolean;
} | undefined {
  for (const req of requests) {
    for (const h of req.headers) {
      const name = h.name.toLowerCase();
      if (name === "authorization" && h.value.trim()) {
        const raw = h.value.trim();
        const bearerMatch = raw.match(/^Bearer\s+(.+)$/i);
        if (bearerMatch) {
          return {
            headerName: h.name,
            rawValue: raw,
            tokenValue: bearerMatch[1].trim(),
            hasBearer: true
          };
        }
        return {
          headerName: h.name,
          rawValue: raw,
          tokenValue: raw,
          hasBearer: false
        };
      }
      if (name === "x-api-key" && h.value.trim()) {
        return {
          headerName: h.name,
          rawValue: h.value.trim(),
          tokenValue: h.value.trim(),
          hasBearer: false
        };
      }
    }
  }
  return undefined;
}
