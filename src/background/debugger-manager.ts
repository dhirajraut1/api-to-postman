const attachedTabs = new Set<number>();
export async function attachToTab(tabId: number): Promise<void> {
  if (attachedTabs.has(tabId)) return;
  await chrome.debugger.attach({ tabId }, "1.3");
  try {
    await chrome.debugger.sendCommand({ tabId }, "Network.enable", {
      maxTotalBufferSize: 20_000_000,
      maxResourceBufferSize: 2_000_000
    });
    attachedTabs.add(tabId);
  } catch (error) {
    await chrome.debugger.detach({ tabId }).catch(() => undefined);
    throw error;
  }
}
export async function detachFromTab(tabId: number): Promise<void> {
  if (!attachedTabs.has(tabId)) return;
  try { await chrome.debugger.detach({ tabId }); }
  finally { attachedTabs.delete(tabId); }
}
export function isAttached(tabId: number): boolean { return attachedTabs.has(tabId); }
export function markDetached(tabId: number): void { attachedTabs.delete(tabId); }
