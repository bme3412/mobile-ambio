// Web uses Cache Storage; metadata remains available if the browser evicts audio.
const name = "ambio-edition-audio-v1";
const key = (id: string) =>
  new URL(
    `/__offline_editions/${encodeURIComponent(id)}`,
    globalThis.location.origin,
  ).href;
export async function localAudio(id: string): Promise<string | null> {
  if (typeof caches === "undefined") return null;
  const response = await (await caches.open(name)).match(key(id));
  return response ? URL.createObjectURL(await response.blob()) : null;
}
export async function saveAudio(
  id: string,
  url: string,
  bytes: number,
): Promise<void> {
  if (typeof caches === "undefined")
    throw Error("Offline downloads are not available in this browser.");
  const response = await fetch(url);
  if (!response.ok) throw Error("Download failed. Please retry.");
  const blob = await response.blob();
  if (blob.size !== bytes)
    throw Error("Incomplete audio download. Please retry.");
  await (
    await caches.open(name)
  ).put(
    key(id),
    new Response(blob, { headers: { "Content-Type": "audio/mpeg" } }),
  );
}
export async function removeAudio(id: string) {
  if (typeof caches !== "undefined")
    await (await caches.open(name)).delete(key(id));
}
export function releaseAudio(uri: string) {
  if (uri.startsWith("blob:")) URL.revokeObjectURL(uri);
}
