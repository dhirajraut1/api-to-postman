export interface PostmanHeader { key: string; value: string; disabled?: boolean; description?: string }
export interface PostmanQueryParam { key: string; value: string; disabled?: boolean }
export interface PostmanRequest {
  method: string;
  header: PostmanHeader[];
  url: { raw: string; query?: PostmanQueryParam[] };
  body?: { mode: "raw" | "urlencoded" | "formdata"; raw?: string; urlencoded?: Array<{ key: string; value: string; type?: "text" }>; options?: { raw?: { language: "json" | "text" | "xml" } } };
}
export interface PostmanItem { name: string; request: PostmanRequest }
export interface PostmanCollection {
  info: { name: string; description?: string; schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" };
  item: PostmanItem[];
}
