import { describe, expect, it } from "vitest";
import { buildPostmanEnvironment, buildAllEnvironments } from "../../src/exporters/environment-builder";
import { detectBaseUrls, detectAuthToken, DEFAULT_VARIABLE_CONFIG } from "../../src/domain/environment";
import type { CapturedRequest } from "../../src/domain/request";

describe("environment-builder", () => {
  it("builds a valid Postman Environment JSON v1.0 object", () => {
    const env = buildPostmanEnvironment({
      name: "Staging",
      baseUrl: "https://staging-api.example.com",
      baseUrlVar: "baseUrl",
      authToken: "secret-token-123",
      authTokenVar: "authToken",
      isSecretToken: true
    });

    expect(env.name).toBe("Staging");
    expect(env._postman_variable_scope).toBe("environment");
    expect(env.values).toHaveLength(2);

    const baseUrlEntry = env.values.find(v => v.key === "baseUrl");
    expect(baseUrlEntry).toEqual({
      key: "baseUrl",
      value: "https://staging-api.example.com",
      type: "default",
      enabled: true
    });

    const tokenEntry = env.values.find(v => v.key === "authToken");
    expect(tokenEntry).toEqual({
      key: "authToken",
      value: "secret-token-123",
      type: "secret",
      enabled: true
    });
  });

  it("builds all configured environments", () => {
    const config = {
      ...DEFAULT_VARIABLE_CONFIG,
      baseUrlVar: "baseUrl",
      authTokenVar: "token",
      environments: [
        { id: "dev", name: "Development", baseUrl: "https://dev.example.com", authToken: "dev-tok" },
        { id: "prod", name: "Production", baseUrl: "https://api.example.com", authToken: "prod-tok" }
      ]
    };

    const envs = buildAllEnvironments(config);
    expect(envs).toHaveLength(2);
    expect(envs[0].name).toBe("Development");
    expect(envs[1].name).toBe("Production");
    expect(envs[0].values.find(v => v.key === "baseUrl")?.value).toBe("https://dev.example.com");
  });
});

describe("detection utilities", () => {
  const req1: CapturedRequest = {
    id: "1", tabId: 1, requestId: "r1", timestamp: 1, source: "cdp", method: "GET",
    url: "https://api.example.com/v1/users", headers: [{ name: "Authorization", value: "Bearer eyJtok1" }],
    queryParams: [], state: "complete", selected: true
  };
  const req2: CapturedRequest = {
    id: "2", tabId: 1, requestId: "r2", timestamp: 2, source: "cdp", method: "POST",
    url: "https://api.example.com/v1/auth", headers: [],
    queryParams: [], state: "complete", selected: true
  };
  const req3: CapturedRequest = {
    id: "3", tabId: 1, requestId: "r3", timestamp: 3, source: "cdp", method: "GET",
    url: "https://cdn.example.com/assets/logo.png", headers: [],
    queryParams: [], state: "complete", selected: true
  };

  it("detects and ranks base URLs by frequency", () => {
    const urls = detectBaseUrls([req1, req2, req3]);
    expect(urls[0]).toBe("https://api.example.com");
    expect(urls[1]).toBe("https://cdn.example.com");
  });

  it("detects Bearer authorization token", () => {
    const detected = detectAuthToken([req1, req2]);
    expect(detected).toBeDefined();
    expect(detected?.hasBearer).toBe(true);
    expect(detected?.tokenValue).toBe("eyJtok1");
  });
});
