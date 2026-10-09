import type { PostmanEnvironment, PostmanEnvironmentValue } from "./postman-types";
import type { EnvironmentProfile, VariableMappingConfig } from "../domain/environment";

export interface BuildEnvironmentOptions {
  name: string;
  baseUrl?: string;
  baseUrlVar?: string;
  authToken?: string;
  authTokenVar?: string;
  customVariables?: Record<string, string>;
  isSecretToken?: boolean;
}

/**
 * Builds a Postman Environment JSON v1.0 object from configuration.
 */
export function buildPostmanEnvironment(options: BuildEnvironmentOptions): PostmanEnvironment {
  const values: PostmanEnvironmentValue[] = [];
  const baseUrlVar = options.baseUrlVar?.trim() || "baseUrl";
  const authTokenVar = options.authTokenVar?.trim() || "authToken";

  if (options.baseUrl !== undefined) {
    values.push({
      key: baseUrlVar,
      value: options.baseUrl,
      type: "default",
      enabled: true
    });
  }

  if (options.authToken !== undefined) {
    values.push({
      key: authTokenVar,
      value: options.authToken,
      type: options.isSecretToken ? "secret" : "default",
      enabled: true
    });
  }

  if (options.customVariables) {
    for (const [key, val] of Object.entries(options.customVariables)) {
      if (!values.some(v => v.key === key)) {
        values.push({
          key,
          value: val,
          type: "default",
          enabled: true
        });
      }
    }
  }

  return {
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : undefined,
    name: options.name,
    values,
    _postman_variable_scope: "environment",
    _postman_exported_at: new Date().toISOString(),
    _postman_exported_using: "API to Postman Chrome Extension"
  };
}

/**
 * Builds Postman Environments for all configured profiles.
 */
export function buildAllEnvironments(config: VariableMappingConfig): PostmanEnvironment[] {
  return config.environments.map(profile => {
    return buildPostmanEnvironment({
      name: profile.name,
      baseUrl: profile.baseUrl,
      baseUrlVar: config.baseUrlVar,
      authToken: profile.authToken,
      authTokenVar: config.authTokenVar,
      customVariables: profile.variables,
      isSecretToken: true
    });
  });
}

/**
 * Triggers browser download of a Postman Environment JSON file.
 */
export function downloadEnvironment(env: PostmanEnvironment, filename?: string): void {
  const name = filename || `postman-environment-${env.name.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}.json`;
  const blob = new Blob([JSON.stringify(env, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name.replace(/[\\/:*?"<>|]/g, "_");
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
