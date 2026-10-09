import type { PostmanCollection } from "./postman-types";
export function downloadCollection(collection: PostmanCollection, filename = "captured-api-collection.json"): void {
  const blob = new Blob([JSON.stringify(collection, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename.replace(/[\\/:*?"<>|]/g, "_");
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
