import { Directory, File, Paths } from "expo-file-system";
const directory = () => new Directory(Paths.document, "editions");
const file = (id: string) =>
  new File(directory(), `${encodeURIComponent(id)}.mp3`);
export async function localAudio(id: string): Promise<string | null> {
  const saved = file(id);
  return saved.exists && saved.size > 0 ? saved.uri : null;
}
export async function saveAudio(
  id: string,
  url: string,
  bytes: number,
): Promise<void> {
  directory().create({ idempotent: true, intermediates: true });
  const temporary = new File(directory(), `${encodeURIComponent(id)}.partial`);
  let completed = false;
  try {
    if (temporary.exists) temporary.delete();
    await File.downloadFileAsync(url, temporary);
    if (temporary.size !== bytes)
      throw Error("Incomplete audio download. Please retry.");
    const destination = file(id);
    if (destination.exists) destination.delete();
    await temporary.move(destination);
    completed = true;
  } finally {
    if (!completed && temporary.exists) temporary.delete();
  }
}
export async function removeAudio(id: string) {
  const saved = file(id);
  if (saved.exists) saved.delete();
}
export function releaseAudio(_uri: string) {}
