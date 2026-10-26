import type { CapturedRequest } from "./request";
import type { PostmanEvent } from "../exporters/postman-types";

export type StatusTestMode = "exact" | "2xx";

export interface PostmanTestConfig {
  /** Master toggle to include tests in the Postman collection items */
  enabled: boolean;
  /** Check HTTP status code */
  checkStatus: boolean;
  /** Check for exact captured code or general 2xx success */
  statusMode: StatusTestMode;
  /** Check response latency */
  checkResponseTime: boolean;
  /** Maximum acceptable response time in milliseconds */
  responseTimeMs: number;
  /** Verify Content-Type header exists */
  checkContentType: boolean;
  /** Verify response body is valid JSON */
  checkJsonBody: boolean;
  /** Verify response body is not empty */
  checkBodyNotEmpty: boolean;
}

export const DEFAULT_TEST_CONFIG: PostmanTestConfig = {
  enabled: true,
  checkStatus: true,
  statusMode: "exact",
  checkResponseTime: true,
  responseTimeMs: 500,
  checkContentType: true,
  checkJsonBody: true,
  checkBodyNotEmpty: false
};

/**
 * Generates an array of script lines for the Postman test sandbox (`pm.*`).
 */
export function buildTestScriptLines(
  request?: CapturedRequest,
  config: Partial<PostmanTestConfig> = DEFAULT_TEST_CONFIG
): string[] {
  const merged: PostmanTestConfig = { ...DEFAULT_TEST_CONFIG, ...config };
  if (!merged.enabled) {
    return [];
  }

  const lines: string[] = [];
  const addSnippet = (snippet: string[]) => {
    if (lines.length > 0) {
      lines.push("");
    }
    lines.push(...snippet);
  };

  // 1. Status Code Check
  if (merged.checkStatus) {
    if (merged.statusMode === "2xx") {
      addSnippet([
        'pm.test("Status code is 2xx success", function () {',
        '    pm.response.to.be.success;',
        '});'
      ]);
    } else {
      const status = request?.response?.status && request.response.status > 0
        ? request.response.status
        : 200;
      addSnippet([
        `pm.test("Status code is ${status}", function () {`,
        `    pm.response.to.have.status(${status});`,
        '});'
      ]);
    }
  }

  // 2. Response Time Check
  if (merged.checkResponseTime) {
    const limit = merged.responseTimeMs > 0 ? merged.responseTimeMs : 500;
    addSnippet([
      `pm.test("Response time is less than ${limit}ms", function () {`,
      `    pm.expect(pm.response.responseTime).to.be.below(${limit});`,
      '});'
    ]);
  }

  // 3. Content-Type Header Check
  if (merged.checkContentType) {
    addSnippet([
      'pm.test("Content-Type header is present", function () {',
      '    pm.response.to.have.header("Content-Type");',
      '});'
    ]);
  }

  // 4. Valid JSON Check
  if (merged.checkJsonBody) {
    addSnippet([
      'pm.test("Response is valid JSON", function () {',
      '    pm.response.to.be.json;',
      '    const jsonData = pm.response.json();',
      '    pm.expect(jsonData).to.not.be.null;',
      '});'
    ]);
  }

  // 5. Response Body Not Empty Check
  if (merged.checkBodyNotEmpty) {
    addSnippet([
      'pm.test("Response body is not empty", function () {',
      '    pm.response.to.be.withBody;',
      '});'
    ]);
  }

  return lines;
}

/**
 * Builds a PostmanEvent object configured for collection item test execution.
 */
export function buildPostmanTestEvent(
  request?: CapturedRequest,
  config: Partial<PostmanTestConfig> = DEFAULT_TEST_CONFIG
): PostmanEvent | undefined {
  const lines = buildTestScriptLines(request, config);
  if (lines.length === 0) {
    return undefined;
  }

  return {
    listen: "test",
    script: {
      type: "text/javascript",
      exec: lines
    }
  };
}
