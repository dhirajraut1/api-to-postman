import "./styles.css";
import type { CapturedRequest } from "../domain/request";
import type { ExtensionMessage } from "../domain/messages";
import type { EnvironmentProfile } from "../domain/environment";
import { DEFAULT_ENVIRONMENTS, detectBaseUrls, detectAuthToken } from "../domain/environment";
import { buildCollection, parameterizeUrl } from "../exporters/postman-builder";
import { downloadCollection } from "../exporters/json-download";
import { createPostmanCollection, createPostmanEnvironment } from "../exporters/postman-api-client";
import {
  buildPostmanEnvironment,
  downloadEnvironment,
  buildAllEnvironments
} from "../exporters/environment-builder";

const tabId = chrome.devtools.inspectedWindow.tabId;
const requests = new Map<string, CapturedRequest>();
let activeRequestId: string | undefined;

let environmentProfiles: EnvironmentProfile[] = structuredClone(DEFAULT_ENVIRONMENTS);
let activeEnvId = "dev";

const $ = <T extends HTMLElement>(selector: string): T => document.querySelector<T>(selector)!;

// Header & Controls
const status = $("#status");
const list = $("#requests");
const details = $("#details");
const search = $("#search") as HTMLInputElement;
const methodFilter = $("#method-filter") as HTMLSelectElement;
const statusFilter = $("#status-filter") as HTMLSelectElement;
const selectVisible = $("#select-visible") as HTMLInputElement;
const count = $("#count");

// Postman Export Fields
const apiKey = $("#api-key") as HTMLInputElement;
const workspaceId = $("#workspace-id") as HTMLInputElement;
const collectionName = $("#collection-name") as HTMLInputElement;
const copyCurlButton = $("#copy-curl") as HTMLButtonElement;
const copyJsonButton = $("#copy-json") as HTMLButtonElement;

// Variables & Environment Elements
const baseUrlValue = $("#base-url-value") as HTMLInputElement;
const baseUrlVar = $("#base-url-var") as HTMLInputElement;
const enableBaseUrlVar = $("#enable-base-url-var") as HTMLInputElement;
const btnDetectUrl = $("#btn-detect-url") as HTMLButtonElement;

const authTokenValue = $("#auth-token-value") as HTMLInputElement;
const authTokenVar = $("#auth-token-var") as HTMLInputElement;
const enableAuthVar = $("#enable-auth-var") as HTMLInputElement;
const btnDetectAuth = $("#btn-detect-auth") as HTMLButtonElement;

const envProfileSelect = $("#env-profile-select") as HTMLSelectElement;
const downloadEnvBtn = $("#download-env") as HTMLButtonElement;
const downloadAllEnvsBtn = $("#download-all-envs") as HTMLButtonElement;
const downloadBundleBtn = $("#download-bundle") as HTMLButtonElement;
const publishEnvBtn = $("#publish-env") as HTMLButtonElement;

const send = (message: ExtensionMessage) => chrome.runtime.sendMessage(message);

function syncCurrentProfileFromInputs(): void {
  const current = environmentProfiles.find(p => p.id === activeEnvId);
  if (current) {
    current.baseUrl = baseUrlValue.value.trim();
    current.authToken = authTokenValue.value.trim();
  }
}

function loadProfileIntoInputs(profileId: string): void {
  activeEnvId = profileId;
  const profile = environmentProfiles.find(p => p.id === profileId);
  if (profile) {
    baseUrlValue.value = profile.baseUrl || "";
    authTokenValue.value = profile.authToken || "";
  }
}

function getVariableMappingOptions() {
  syncCurrentProfileFromInputs();
  return {
    enabled: enableBaseUrlVar.checked || enableAuthVar.checked,
    baseUrlVar: baseUrlVar.value.trim() || "baseUrl",
    baseUrlValue: enableBaseUrlVar.checked ? baseUrlValue.value.trim() : "",
    authTokenVar: authTokenVar.value.trim() || "authToken",
    authTokenValue: enableAuthVar.checked ? authTokenValue.value.trim() : "",
    bearerPrefix: true
  };
}

function visibleRequests(): CapturedRequest[] {
  const query = search.value.trim().toLowerCase();
  return [...requests.values()].filter(request => {
    const matchesText = !query || `${request.method} ${request.url} ${request.response?.status ?? ""}`.toLowerCase().includes(query);
    const matchesMethod = !methodFilter.value || request.method.toUpperCase() === methodFilter.value;
    const responseStatus = request.response?.status;
    const matchesStatus = !statusFilter.value || (statusFilter.value === "none" ? responseStatus === undefined : String(responseStatus ?? "").startsWith(statusFilter.value));
    return matchesText && matchesMethod && matchesStatus;
  });
}

function selectedRequests(): CapturedRequest[] {
  return [...requests.values()].filter(r => r.selected && !r.excludedFromExport);
}

function renderDetails(request?: CapturedRequest): void {
  activeRequestId = request?.id;
  copyCurlButton.disabled = !request;
  copyJsonButton.disabled = !request;
  if (!request) {
    details.textContent = "Select a request to inspect request and response details.";
    return;
  }

  const varOpts = getVariableMappingOptions();
  let parameterizedUrlStr = request.url;
  if (varOpts.enabled && varOpts.baseUrlValue) {
    parameterizedUrlStr = parameterizeUrl(request.url, varOpts.baseUrlVar, varOpts.baseUrlValue).raw;
  }

  const view = {
    request: {
      method: request.method,
      url: request.url,
      parameterizedUrl: parameterizedUrlStr !== request.url ? parameterizedUrlStr : undefined,
      state: request.state,
      resourceType: request.resourceType,
      timestamp: new Date(request.timestamp).toISOString(),
      headers: request.headers,
      queryParams: request.queryParams,
      body: request.requestBody
    },
    variables: {
      activeEnvironment: environmentProfiles.find(p => p.id === activeEnvId)?.name || activeEnvId,
      mappedBaseUrl: varOpts.baseUrlValue ? `{{${varOpts.baseUrlVar}}} -> ${varOpts.baseUrlValue}` : "None",
      mappedAuthToken: varOpts.authTokenValue ? `{{${varOpts.authTokenVar}}} (configured)` : "None"
    },
    response: request.response ? {
      status: request.response.status,
      statusText: request.response.statusText,
      mimeType: request.response.mimeType,
      headers: request.response.headers,
      body: request.response.body,
      fromDiskCache: request.response.fromDiskCache,
      fromServiceWorker: request.response.fromServiceWorker
    } : undefined,
    failureReason: request.failureReason
  };

  details.textContent = JSON.stringify(view, null, 2);
}

function render(): void {
  const visible = visibleRequests();
  list.replaceChildren();

  for (const request of visible) {
    const row = document.createElement("div");
    row.className = "request-row";
    row.setAttribute("role", "listitem");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = request.selected;
    checkbox.setAttribute("aria-label", `Select ${request.method} ${request.url}`);
    checkbox.addEventListener("change", () => {
      request.selected = checkbox.checked;
      count.textContent = `${selectedRequests().length} selected · ${requests.size} captured`;
    });

    const open = document.createElement("button");
    open.type = "button";
    open.className = "request-open";

    const method = document.createElement("span");
    method.className = `method method-${request.method.toLowerCase()}`;
    method.textContent = request.method;

    const url = document.createElement("span");
    url.className = "request-url";
    url.textContent = request.url;
    url.title = request.url;

    const badge = document.createElement("span");
    badge.className = "status-code";
    badge.textContent = String(request.response?.status ?? request.state);

    open.append(method, url, badge);
    open.addEventListener("click", () => renderDetails(request));

    row.append(checkbox, open);
    list.append(row);
  }

  count.textContent = `${selectedRequests().length} selected · ${requests.size} captured`;
  selectVisible.checked = visible.length > 0 && visible.every(r => r.selected);
  if (activeRequestId && requests.has(activeRequestId)) {
    renderDetails(requests.get(activeRequestId));
  }
}

function getExportRequests(all = false): CapturedRequest[] {
  const chosen = all ? [...requests.values()] : selectedRequests();
  return chosen.filter(r => !r.excludedFromExport);
}

function exportDownload(all = false): void {
  const chosen = getExportRequests(all);
  if (!chosen.length) {
    status.textContent = "Select one or more requests before exporting.";
    return;
  }
  const varOpts = getVariableMappingOptions();
  const collName = collectionName.value.trim() || "Captured API Requests";

  downloadCollection(buildCollection(chosen, { name: collName, variableMapping: varOpts }));
  status.textContent = `Downloaded collection with ${chosen.length} request(s) and variable mapping.`;
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function toCurl(request: CapturedRequest): string {
  const varOpts = getVariableMappingOptions();
  let targetUrl = request.url;

  if (varOpts.enabled && varOpts.baseUrlValue) {
    targetUrl = parameterizeUrl(request.url, varOpts.baseUrlVar, varOpts.baseUrlValue).raw;
  }

  const parts = ["curl", "-X", shellQuote(request.method), shellQuote(targetUrl)];

  for (const header of request.headers) {
    const lower = header.name.toLowerCase();
    if (["host", "content-length", "connection"].includes(lower)) continue;

    let safeValue = header.value;
    if (lower === "authorization" && varOpts.enabled) {
      const isBearer = /^Bearer\s+/i.test(header.value);
      safeValue = isBearer ? `Bearer {{${varOpts.authTokenVar}}}` : `{{${varOpts.authTokenVar}}}`;
    } else if (lower === "x-api-key" && varOpts.enabled) {
      safeValue = `{{${varOpts.authTokenVar}}}`;
    } else if (/^(cookie|set-cookie|proxy-authorization)$/i.test(lower)) {
      safeValue = `{{${lower.replace(/[^a-z0-9_]/g, "_")}}}`;
    }

    parts.push("-H", shellQuote(`${header.name}: ${safeValue}`));
  }

  if (request.requestBody?.text && !["binary", "multipart"].includes(request.requestBody.kind)) {
    parts.push("--data-raw", shellQuote(request.requestBody.text));
  }

  return parts.join(" ");
}

async function copyText(text: string, success: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = success;
  } catch {
    status.textContent = "Clipboard access failed. Select and copy the content from the inspector.";
  }
}

// Auto-detection event handlers
btnDetectUrl.addEventListener("click", () => {
  const reqList = [...requests.values()];
  const origins = detectBaseUrls(reqList);
  if (!origins.length) {
    status.textContent = "No captured requests yet to detect base URL.";
    return;
  }
  baseUrlValue.value = origins[0];
  syncCurrentProfileFromInputs();
  status.textContent = `Auto-detected base URL: ${origins[0]}`;
  if (activeRequestId && requests.has(activeRequestId)) renderDetails(requests.get(activeRequestId));
});

btnDetectAuth.addEventListener("click", () => {
  const reqList = [...requests.values()];
  const detected = detectAuthToken(reqList);
  if (!detected) {
    status.textContent = "No Authorization or X-API-Key headers found in captured requests.";
    return;
  }
  authTokenValue.value = detected.tokenValue;
  syncCurrentProfileFromInputs();
  status.textContent = `Auto-detected auth token from ${detected.headerName} header.`;
  if (activeRequestId && requests.has(activeRequestId)) renderDetails(requests.get(activeRequestId));
});

// Environment profile dropdown change
envProfileSelect.addEventListener("change", () => {
  loadProfileIntoInputs(envProfileSelect.value);
  const currentProfile = environmentProfiles.find(p => p.id === activeEnvId);
  status.textContent = `Switched to ${currentProfile?.name || activeEnvId} profile.`;
  if (activeRequestId && requests.has(activeRequestId)) renderDetails(requests.get(activeRequestId));
});

baseUrlValue.addEventListener("input", syncCurrentProfileFromInputs);
authTokenValue.addEventListener("input", syncCurrentProfileFromInputs);

// Download Environment JSON
downloadEnvBtn.addEventListener("click", () => {
  syncCurrentProfileFromInputs();
  const currentProfile = environmentProfiles.find(p => p.id === activeEnvId) || {
    id: activeEnvId,
    name: "Active Environment",
    baseUrl: baseUrlValue.value,
    authToken: authTokenValue.value
  };

  const env = buildPostmanEnvironment({
    name: currentProfile.name,
    baseUrl: currentProfile.baseUrl,
    baseUrlVar: baseUrlVar.value.trim() || "baseUrl",
    authToken: currentProfile.authToken,
    authTokenVar: authTokenVar.value.trim() || "authToken",
    isSecretToken: true
  });

  downloadEnvironment(env);
  status.textContent = `Downloaded Postman Environment: ${env.name}`;
});

// Download All Environments
downloadAllEnvsBtn.addEventListener("click", () => {
  syncCurrentProfileFromInputs();
  const envs = buildAllEnvironments({
    enabled: true,
    baseUrlVar: baseUrlVar.value.trim() || "baseUrl",
    baseUrlValue: baseUrlValue.value,
    authTokenVar: authTokenVar.value.trim() || "authToken",
    authTokenValue: authTokenValue.value,
    bearerPrefix: true,
    environments: environmentProfiles,
    activeEnvironmentId: activeEnvId
  });

  envs.forEach((env, index) => {
    window.setTimeout(() => downloadEnvironment(env), index * 300);
  });
  status.textContent = `Downloaded ${envs.length} Postman Environment profiles.`;
});

// Download Collection + Environment Bundle
downloadBundleBtn.addEventListener("click", () => {
  const chosen = getExportRequests(false);
  if (!chosen.length) {
    status.textContent = "Select one or more requests before exporting.";
    return;
  }

  exportDownload(false);

  window.setTimeout(() => {
    syncCurrentProfileFromInputs();
    const currentProfile = environmentProfiles.find(p => p.id === activeEnvId);
    const env = buildPostmanEnvironment({
      name: currentProfile?.name || "Environment",
      baseUrl: currentProfile?.baseUrl || baseUrlValue.value,
      baseUrlVar: baseUrlVar.value.trim() || "baseUrl",
      authToken: currentProfile?.authToken || authTokenValue.value,
      authTokenVar: authTokenVar.value.trim() || "authToken",
      isSecretToken: true
    });
    downloadEnvironment(env);
    status.textContent = "Downloaded Postman Collection and Environment files.";
  }, 400);
});

// Publish Environment to Postman
publishEnvBtn.addEventListener("click", async () => {
  if (!apiKey.value.trim() || !workspaceId.value.trim()) {
    status.textContent = "Enter your Postman API key and Workspace ID to publish an environment.";
    return;
  }

  syncCurrentProfileFromInputs();
  const currentProfile = environmentProfiles.find(p => p.id === activeEnvId);
  const env = buildPostmanEnvironment({
    name: currentProfile?.name || "Environment",
    baseUrl: currentProfile?.baseUrl || baseUrlValue.value,
    baseUrlVar: baseUrlVar.value.trim() || "baseUrl",
    authToken: currentProfile?.authToken || authTokenValue.value,
    authTokenVar: authTokenVar.value.trim() || "authToken",
    isSecretToken: true
  });

  status.textContent = `Publishing ${env.name} environment to Postman…`;
  try {
    const result = await createPostmanEnvironment({ apiKey: apiKey.value, workspaceId: workspaceId.value }, env);
    status.textContent = `Created environment “${result.name}” in Postman (ID: ${result.id}).`;
  } catch (error) {
    status.textContent = `Environment publish failed: ${error instanceof Error ? error.message : String(error)}`;
  }
});

// Capture and general buttons
$("#start").addEventListener("click", async () => {
  const result = await send({ type: "CAPTURE_START", tabId }) as { ok?: boolean; error?: string };
  status.textContent = result.ok ? "Recording network traffic…" : `Capture error: ${result.error ?? "unknown error"}`;
});

$("#stop").addEventListener("click", async () => {
  const result = await send({ type: "CAPTURE_STOP", tabId }) as { ok?: boolean; error?: string };
  status.textContent = result.ok ? "Capture stopped." : `Capture error: ${result.error ?? "unknown error"}`;
});

$("#clear").addEventListener("click", async () => {
  await send({ type: "CAPTURE_CLEAR", tabId });
  requests.clear();
  renderDetails();
  render();
  status.textContent = "Capture cleared.";
});

$("#download").addEventListener("click", () => exportDownload(false));
$("#export-all").addEventListener("click", () => exportDownload(true));

$("#publish").addEventListener("click", async () => {
  const chosen = getExportRequests(false);
  if (!chosen.length) {
    status.textContent = "Select one or more requests before publishing.";
    return;
  }
  status.textContent = "Creating Postman collection…";
  try {
    const varOpts = getVariableMappingOptions();
    const result = await createPostmanCollection(
      { apiKey: apiKey.value, workspaceId: workspaceId.value },
      buildCollection(chosen, {
        name: collectionName.value.trim() || "Captured API Requests",
        variableMapping: varOpts
      })
    );
    status.textContent = `Created “${result.name}” in Postman (ID: ${result.id}).`;
  } catch (error) {
    status.textContent = `Postman publish failed: ${error instanceof Error ? error.message : String(error)}`;
  }
});

$("#save-settings").addEventListener("click", async () => {
  syncCurrentProfileFromInputs();
  try {
    await chrome.storage.local.set({
      postmanApiKey: apiKey.value,
      postmanWorkspaceId: workspaceId.value,
      postmanCollectionName: collectionName.value,
      baseUrlVar: baseUrlVar.value,
      authTokenVar: authTokenVar.value,
      enableBaseUrlVar: enableBaseUrlVar.checked,
      enableAuthVar: enableAuthVar.checked,
      environmentProfiles,
      activeEnvId
    });
    status.textContent = "Settings, variables, and environment profiles saved locally.";
  } catch {
    status.textContent = "Could not save settings. You can still download collections and environments.";
  }
});

selectVisible.addEventListener("change", () => {
  for (const request of visibleRequests()) request.selected = selectVisible.checked;
  render();
});

search.addEventListener("input", render);
methodFilter.addEventListener("change", render);
statusFilter.addEventListener("change", render);

copyCurlButton.addEventListener("click", () => {
  const request = activeRequestId ? requests.get(activeRequestId) : undefined;
  if (request) void copyText(toCurl(request), "Copied parameterized cURL command.");
});

copyJsonButton.addEventListener("click", () => {
  const request = activeRequestId ? requests.get(activeRequestId) : undefined;
  if (request) void copyText(details.textContent ?? "", "Copied request details.");
});

// Runtime messages
chrome.runtime.onMessage.addListener((raw: unknown) => {
  const message = raw as ExtensionMessage;
  if (!message || !("tabId" in message) || message.tabId !== tabId) return;

  if (message.type === "REQUESTS_UPDATED") {
    const previous = requests.get(message.request.id);
    requests.set(message.request.id, {
      ...previous,
      ...message.request,
      selected: previous?.selected ?? message.request.selected ?? false
    });

    // Auto-detect baseUrl if not set yet
    if (!baseUrlValue.value.trim()) {
      const origins = detectBaseUrls([...requests.values()]);
      if (origins.length > 0) {
        baseUrlValue.value = origins[0];
        syncCurrentProfileFromInputs();
      }
    }

    render();
  }

  if (message.type === "REQUESTS_CLEARED") {
    requests.clear();
    renderDetails();
    render();
  }

  if (message.type === "CAPTURE_STATUS") {
    status.textContent = message.active ? "Recording network traffic…" : "Capture stopped.";
  }

  if (message.type === "CAPTURE_ERROR") {
    status.textContent = message.message;
  }
});

// Restore settings on load
void chrome.storage.local.get([
  "postmanApiKey",
  "postmanWorkspaceId",
  "postmanCollectionName",
  "baseUrlVar",
  "authTokenVar",
  "enableBaseUrlVar",
  "enableAuthVar",
  "environmentProfiles",
  "activeEnvId"
]).then(settings => {
  apiKey.value = String(settings.postmanApiKey ?? "");
  workspaceId.value = String(settings.postmanWorkspaceId ?? "");
  collectionName.value = String(settings.postmanCollectionName ?? "Captured API Requests");
  if (settings.baseUrlVar) baseUrlVar.value = String(settings.baseUrlVar);
  if (settings.authTokenVar) authTokenVar.value = String(settings.authTokenVar);
  if (typeof settings.enableBaseUrlVar === "boolean") enableBaseUrlVar.checked = settings.enableBaseUrlVar;
  if (typeof settings.enableAuthVar === "boolean") enableAuthVar.checked = settings.enableAuthVar;

  if (Array.isArray(settings.environmentProfiles) && settings.environmentProfiles.length > 0) {
    environmentProfiles = settings.environmentProfiles as EnvironmentProfile[];
  }
  if (settings.activeEnvId) {
    activeEnvId = String(settings.activeEnvId);
    envProfileSelect.value = activeEnvId;
  }
  loadProfileIntoInputs(activeEnvId);
}).catch(() => undefined);

// Initial request snapshot
void send({ type: "REQUESTS_SNAPSHOT", tabId }).then((raw: unknown) => {
  const result = raw as { requests?: CapturedRequest[]; active?: boolean };
  for (const request of result.requests ?? []) {
    requests.set(request.id, { ...request, selected: request.selected ?? false });
  }

  if (!baseUrlValue.value.trim() && requests.size > 0) {
    const origins = detectBaseUrls([...requests.values()]);
    if (origins.length > 0) {
      baseUrlValue.value = origins[0];
      syncCurrentProfileFromInputs();
    }
  }

  status.textContent = result.active ? "Recording network traffic…" : "Ready. Start capture to begin.";
  render();
}).catch(() => {
  status.textContent = "Ready. Start capture to begin.";
});
