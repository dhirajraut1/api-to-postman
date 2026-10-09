const patterns = [/bearer\s+[a-z0-9._~+\/-]+=*/i, /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/];
export function containsLikelySecret(value: string): boolean { return patterns.some(pattern => pattern.test(value)); }
