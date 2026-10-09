import type { PostmanCollection } from "./postman-types";
export interface PostmanExportConfig { apiKey: string; workspaceId: string }
export async function createPostmanCollection(config: PostmanExportConfig, collection: PostmanCollection): Promise<{ id: string; name: string; uid?: string }> {
  if (!config.apiKey.trim()) throw new Error("Postman API key is required.");
  if (!config.workspaceId.trim()) throw new Error("Postman workspace ID is required.");
  const url = new URL("https://api.postman.com/collections");
  url.searchParams.set("workspace", config.workspaceId);
  const response = await fetch(url.toString(), { method: "POST", headers: { "X-API-Key": config.apiKey, "Content-Type": "application/json" }, body: JSON.stringify({ collection }) });
  if (!response.ok) throw new Error(`Postman export failed with HTTP ${response.status}.`);
  const result = await response.json();
  if (!result.collection?.id || !result.collection?.name) throw new Error("Postman returned an unexpected response.");
  return { id: result.collection.id, name: result.collection.name, uid: result.collection.uid };
}
