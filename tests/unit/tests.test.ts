import { describe, expect, it } from "vitest";
import { buildTestScriptLines, buildPostmanTestEvent, DEFAULT_TEST_CONFIG } from "../../src/domain/tests";
import type { CapturedRequest } from "../../src/domain/request";

const sampleReq: CapturedRequest = {
  id: "req-1",
  tabId: 1,
  requestId: "r1",
  timestamp: Date.now(),
  source: "cdp",
  method: "POST",
  url: "https://api.example.com/v1/orders",
  headers: [{ name: "Content-Type", value: "application/json" }],
  queryParams: [],
  response: {
    status: 201,
    statusText: "Created",
    headers: [{ name: "Content-Type", value: "application/json; charset=utf-8" }],
    mimeType: "application/json"
  },
  state: "complete",
  selected: true
};

describe("tests domain", () => {
  it("generates default test scripts when enabled", () => {
    const lines = buildTestScriptLines(sampleReq, DEFAULT_TEST_CONFIG);
    const script = lines.join("\n");

    expect(script).toContain('pm.test("Status code is 201"');
    expect(script).toContain("pm.response.to.have.status(201);");
    expect(script).toContain('pm.test("Response time is less than 500ms"');
    expect(script).toContain("pm.expect(pm.response.responseTime).to.be.below(500);");
    expect(script).toContain('pm.test("Content-Type header is present"');
    expect(script).toContain('pm.test("Response is valid JSON"');
  });

  it("returns empty lines if test generation is disabled", () => {
    const lines = buildTestScriptLines(sampleReq, { enabled: false });
    expect(lines).toHaveLength(0);

    const event = buildPostmanTestEvent(sampleReq, { enabled: false });
    expect(event).toBeUndefined();
  });

  it("supports 2xx success status check mode", () => {
    const lines = buildTestScriptLines(sampleReq, {
      ...DEFAULT_TEST_CONFIG,
      statusMode: "2xx"
    });
    const script = lines.join("\n");

    expect(script).toContain('pm.test("Status code is 2xx success"');
    expect(script).toContain("pm.response.to.be.success;");
  });

  it("falls back to 200 when response status is missing in exact mode", () => {
    const reqWithoutResp: CapturedRequest = {
      ...sampleReq,
      response: undefined
    };
    const lines = buildTestScriptLines(reqWithoutResp, {
      ...DEFAULT_TEST_CONFIG,
      statusMode: "exact"
    });
    const script = lines.join("\n");

    expect(script).toContain('pm.test("Status code is 200"');
    expect(script).toContain("pm.response.to.have.status(200);");
  });

  it("customizes response time limit", () => {
    const lines = buildTestScriptLines(sampleReq, {
      ...DEFAULT_TEST_CONFIG,
      responseTimeMs: 200
    });
    const script = lines.join("\n");

    expect(script).toContain('pm.test("Response time is less than 200ms"');
    expect(script).toContain("pm.expect(pm.response.responseTime).to.be.below(200);");
  });

  it("generates body not empty test when enabled", () => {
    const lines = buildTestScriptLines(sampleReq, {
      ...DEFAULT_TEST_CONFIG,
      checkBodyNotEmpty: true
    });
    const script = lines.join("\n");

    expect(script).toContain('pm.test("Response body is not empty"');
    expect(script).toContain("pm.response.to.be.withBody;");
  });

  it("builds a valid PostmanEvent object", () => {
    const event = buildPostmanTestEvent(sampleReq, DEFAULT_TEST_CONFIG);
    expect(event).toBeDefined();
    expect(event?.listen).toBe("test");
    expect(event?.script.type).toBe("text/javascript");
    expect(Array.isArray(event?.script.exec)).toBe(true);
    expect(event!.script.exec.length).toBeGreaterThan(0);
  });
});
