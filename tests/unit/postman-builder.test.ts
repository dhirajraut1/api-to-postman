import { describe, expect, it } from "vitest";
import { buildCollection } from "../../src/exporters/postman-builder";
import type { CapturedRequest } from "../../src/domain/request";

const sample: CapturedRequest = {
  id: "1",
  tabId: 1,
  requestId: "cdp-1",
  timestamp: 1,
  source: "cdp",
  method: "POST",
  url: "https://api.example.com/v1/payments?currency=NPR",
  headers: [
    { name: "Content-Type", value: "application/json" },
    { name: "Authorization", value: "Bearer eyJhbGciOiJIUzI1NiJ9" }
  ],
  queryParams: [{ name: "currency", value: "NPR" }],
  requestBody: { kind: "json", text: '{"amount":1000}' },
  state: "complete",
  selected: true
};

describe("buildCollection", () => {
  it("builds a Postman v2.1 collection with method, URL and body", () => {
    const collection = buildCollection([sample]);
    expect(collection.info.schema).toContain("collection/v2.1.0");
    expect(collection.item[0].request.method).toBe("POST");
    expect(collection.item[0].request.body?.raw).toBe('{"amount":1000}');
  });

  it("omits requests excluded from export", () => {
    expect(buildCollection([{ ...sample, excludedFromExport: true }]).item).toHaveLength(0);
  });

  it("parameterizes baseUrl with {{baseUrl}} when baseUrlValue is provided", () => {
    const collection = buildCollection([sample], {
      name: "Payments API",
      variableMapping: {
        enabled: true,
        baseUrlVar: "baseUrl",
        baseUrlValue: "https://api.example.com",
        authTokenVar: "authToken",
        authTokenValue: "eyJhbGciOiJIUzI1NiJ9"
      }
    });

    expect(collection.item[0].request.url.raw).toBe("{{baseUrl}}/v1/payments?currency=NPR");
    expect(collection.item[0].request.url.host).toEqual(["{{baseUrl}}"]);
    expect(collection.item[0].request.url.path).toEqual(["v1", "payments"]);

    // Check collection variables
    expect(collection.variable).toBeDefined();
    expect(collection.variable).toContainEqual(
      expect.objectContaining({ key: "baseUrl", value: "https://api.example.com" })
    );
    expect(collection.variable).toContainEqual(
      expect.objectContaining({ key: "authToken", value: "eyJhbGciOiJIUzI1NiJ9" })
    );

    // Check Authorization header has Bearer {{authToken}}
    const authHeader = collection.item[0].request.header.find(h => h.key.toLowerCase() === "authorization");
    expect(authHeader?.value).toBe("Bearer {{authToken}}");
  });

  it("supports custom variable names for baseUrl and auth tokens", () => {
    const collection = buildCollection([sample], {
      name: "Custom Vars API",
      variableMapping: {
        enabled: true,
        baseUrlVar: "apiUrl",
        baseUrlValue: "https://api.example.com",
        authTokenVar: "jwtSecret",
        bearerPrefix: true
      }
    });

    expect(collection.item[0].request.url.raw).toBe("{{apiUrl}}/v1/payments?currency=NPR");
    const authHeader = collection.item[0].request.header.find(h => h.key.toLowerCase() === "authorization");
    expect(authHeader?.value).toBe("Bearer {{jwtSecret}}");
  });
});
