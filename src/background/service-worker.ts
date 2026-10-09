import { clearCapture, snapshot, startCapture, stopCapture } from "../capture/cdp-capture-engine";
import { isAttached } from "./debugger-manager";
import type { ExtensionMessage } from "../domain/messages";

chrome.runtime.onMessage.addListener((raw: unknown, sender, sendResponse) => {
  void (async () => {
    const message = raw as ExtensionMessage;
    if (!message || typeof message !== "object" || !("type" in message)) throw new Error("Invalid message");
    if (message.type === "CAPTURE_START" || message.type === "CAPTURE_STOP" || message.type === "CAPTURE_CLEAR" || message.type === "REQUESTS_SNAPSHOT") {
      if (!Number.isInteger(message.tabId) || message.tabId < 0) throw new Error("Invalid tab ID");
      if (message.type === "CAPTURE_START") await startCapture(message.tabId);
      if (message.type === "CAPTURE_STOP") await stopCapture(message.tabId);
      if (message.type === "CAPTURE_CLEAR") clearCapture(message.tabId);
      if (message.type === "REQUESTS_SNAPSHOT") {
        sendResponse({ ok: true, requests: snapshot(message.tabId), active: isAttached(message.tabId) }); return;
      }
      if (message.type === "CAPTURE_START" || message.type === "CAPTURE_STOP") {
        sendResponse({ ok: true, active: isAttached(message.tabId) }); return;
      }
      sendResponse({ ok: true }); return;
    }
    throw new Error("Unsupported message type");
  })().catch(error => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Unknown error" }));
  return true;
});
chrome.tabs.onRemoved.addListener(tabId => { void stopCapture(tabId).catch(() => undefined); clearCapture(tabId); });
