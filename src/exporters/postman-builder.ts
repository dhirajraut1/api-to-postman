import type { CapturedRequest } from "../domain/request";
import type { PostmanCollection, PostmanItem, PostmanVariable } from "./postman-types";
import { redactRequest } from "../security/redaction";

const SCHEMA = "https://schema.getpostman.com/json/collection/v2.1.0/collection.json";
const OMIT_HEADERS = new Set([
  "host",
  "content-length",
  "connection",
  "accept-encoding",
  "sec-fetch-site",
  "sec-fetch-mode",
  "sec-fetch-dest",
  "priority"
]);

export interface VariableMappingOptions {
  enabled?: boolean;
  baseUrlVar?: string;
  baseUrlValue?: string;
  authTokenVar?: string;
  authTokenValue?: string;
  bearerPrefix?: boolean;
  collectionVariables?: Array<{ key: string; value: string; description?: string }>;
}

export interface CollectionBuilderOptions {
  name?: string;
  variableMapping?: VariableMappingOptions;
}

/**
 * Parameterizes a URL string by substituting matching base URL prefixes with Postman {{variable}}.
 */
export function parameterizeUrl(
  rawUrl: string,
  baseUrlVar = "baseUrl",
  baseUrlValue = ""
): { raw: string; host?: string[]; path?: string[] } {
  try {
    const url = new URL(rawUrl);
    const trimmedBase = baseUrlValue.trim().replace(/\/+$/, "");

    if (trimmedBase) {
      const urlLower = rawUrl.toLowerCase();
      const baseLower = trimmedBase.toLowerCase();

      if (urlLower.startsWith(baseLower)) {
        const remaining = rawUrl.slice(trimmedBase.length);
        if (remaining === "" || remaining.startsWith("/") || remaining.startsWith("?")) {
          const varName = baseUrlVar.trim() || "baseUrl";
          const rawParamUrl = `{{${varName}}}${remaining}`;
          return {
            raw: rawParamUrl,
            host: [`{{${varName}}}`],
            path: url.pathname.split("/").filter(Boolean)
          };
        }
      }
    }

    return {
      raw: rawUrl,
      host: [url.hostname],
      path: url.pathname.split("/").filter(Boolean)
    };
  } catch {
    return { raw: rawUrl };
  }
}

/**
 * Maps headers with variable substitution for auth credentials while preserving redactions.
 */
function parameterizeHeaders(
  request: CapturedRequest,
  varOpts?: VariableMappingOptions
) {
  const redacted = redactRequest(request);
  const authVar = varOpts?.authTokenVar?.trim() || "authToken";
  const keepBearer = varOpts?.bearerPrefix !== false;

  return redacted.headers
    .filter(h => !OMIT_HEADERS.has(h.name.toLowerCase()))
    .map(h => {
      const lower = h.name.toLowerCase();

      if (varOpts?.enabled !== false && lower === "authorization") {
        const origH = request.headers.find(orig => orig.name.toLowerCase() === "authorization");
        const origVal = origH?.value?.trim() || "";
        const isBearer = /^Bearer\s+/i.test(origVal);

        if (isBearer) {
          return {
            key: h.name,
            value: keepBearer ? `Bearer {{${authVar}}}` : `{{${authVar}}}`
          };
        }
        return { key: h.name, value: `{{${authVar}}}` };
      }

      if (varOpts?.enabled !== false && lower === "x-api-key") {
        return { key: h.name, value: `{{${authVar}}}` };
      }

      return { key: h.name, value: h.value };
    });
}

function toPostmanItem(input: CapturedRequest, varOpts?: VariableMappingOptions): PostmanItem {
  const headers = parameterizeHeaders(input, varOpts);
  const url = new URL(input.url);

  let urlObj: { raw: string; host?: string[]; path?: string[]; query?: Array<{ key: string; value: string }> };

  if (varOpts?.enabled !== false && varOpts?.baseUrlValue?.trim()) {
    const parameterized = parameterizeUrl(input.url, varOpts.baseUrlVar, varOpts.baseUrlValue);
    urlObj = {
      raw: parameterized.raw,
      host: parameterized.host,
      path: parameterized.path,
      query: input.queryParams.map(q => ({ key: q.name, value: q.value }))
    };
  } else {
    urlObj = {
      raw: input.url,
      query: input.queryParams.map(q => ({ key: q.name, value: q.value }))
    };
  }

  const item: PostmanItem = {
    name: `${input.method} ${url.pathname}`,
    request: {
      method: input.method,
      header: headers,
      url: urlObj
    }
  };

  const body = input.requestBody;
  if (
    body?.text !== undefined &&
    body.kind !== "binary" &&
    body.kind !== "multipart" &&
    body.kind !== "form-urlencoded"
  ) {
    item.request.body = {
      mode: "raw",
      raw: body.text,
      options: { raw: { language: body.kind === "json" ? "json" : "text" } }
    };
  }

  return item;
}

export function buildCollection(
  requests: CapturedRequest[],
  nameOrOptions: string | CollectionBuilderOptions = "Captured API Requests"
): PostmanCollection {
  const name = typeof nameOrOptions === "string" ? nameOrOptions : (nameOrOptions.name || "Captured API Requests");
  const varOpts = typeof nameOrOptions === "object" ? nameOrOptions.variableMapping : undefined;

  const validRequests = requests.filter(r => !r.excludedFromExport);
  const items = validRequests.map(r => toPostmanItem(r, varOpts));

  const collection: PostmanCollection = {
    info: {
      name,
      description: "Generated from browser network capture with environment variable support.",
      schema: SCHEMA
    },
    item: items
  };

  if (varOpts?.enabled !== false && (varOpts?.baseUrlValue || varOpts?.authTokenValue || varOpts?.collectionVariables)) {
    const variables: PostmanVariable[] = [];

    if (varOpts.baseUrlValue?.trim()) {
      variables.push({
        key: varOpts.baseUrlVar?.trim() || "baseUrl",
        value: varOpts.baseUrlValue.trim(),
        type: "string",
        description: "Base URL for API requests"
      });
    }

    if (varOpts.authTokenValue?.trim()) {
      variables.push({
        key: varOpts.authTokenVar?.trim() || "authToken",
        value: varOpts.authTokenValue.trim(),
        type: "string",
        description: "Authentication token"
      });
    }

    if (varOpts.collectionVariables) {
      for (const cv of varOpts.collectionVariables) {
        if (!variables.some(v => v.key === cv.key)) {
          variables.push({
            key: cv.key,
            value: cv.value,
            type: "string",
            description: cv.description
          });
        }
      }
    }

    if (variables.length > 0) {
      collection.variable = variables;
    }
  }

  return collection;
}
