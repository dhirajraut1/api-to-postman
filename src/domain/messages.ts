import type { CapturedRequest } from "./request";
export type ExtensionMessage =
  | { type: "CAPTURE_START"; tabId: number }
  | { type: "CAPTURE_STOP"; tabId: number }
  | { type: "CAPTURE_CLEAR"; tabId: number }
  | { type: "CAPTURE_STATUS"; tabId: number; active: boolean }
  | { type: "REQUESTS_SNAPSHOT"; tabId: number }
  | { type: "REQUESTS_UPDATED"; tabId: number; request: CapturedRequest }
  | { type: "REQUESTS_CLEARED"; tabId: number }
  | { type: "CAPTURE_ERROR"; tabId: number; message: string };
