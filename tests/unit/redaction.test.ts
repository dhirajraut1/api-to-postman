import { describe, expect, it } from "vitest";
import { redactHeaders } from "../../src/security/redaction";
describe("redactHeaders", () => {
  it("replaces authorization header values with a Postman variable", () => {
    const result = redactHeaders([{ name: "Authorization", value: "Bearer supersecret" }]);
    expect(result[0].value).toBe("{{authorization}}");
  });
});
