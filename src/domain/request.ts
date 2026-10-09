export type CaptureSource = "cdp";
export type BodyKind = "json" | "text" | "form-urlencoded" | "multipart" | "binary" | "unknown" | "none";
export interface HeaderEntry { name: string; value: string; sensitive?: boolean }
export interface QueryEntry { name: string; value: string }
export interface CapturedBody { kind: BodyKind; text?: string; base64Encoded?: boolean; sizeBytes?: number; unavailableReason?: string }
export interface CapturedResponse { status?: number; statusText?: string; headers: HeaderEntry[]; mimeType?: string; body?: CapturedBody; fromDiskCache?: boolean; fromServiceWorker?: boolean; encodedDataLength?: number }
export type CaptureState = "pending" | "complete" | "failed" | "partial";
export interface CapturedRequest {
  id: string; tabId: number; requestId: string; loaderId?: string; frameId?: string;
  timestamp: number; source: CaptureSource; method: string; url: string; protocol?: string; resourceType?: string;
  headers: HeaderEntry[]; queryParams: QueryEntry[]; requestBody?: CapturedBody;
  response?: CapturedResponse; state: CaptureState; failureReason?: string;
  selected: boolean; excludedFromExport?: boolean;
}
