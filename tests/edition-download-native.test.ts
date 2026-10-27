import {
  localAudio,
  saveAudio,
  removeAudio,
} from "../src/data/downloads.native";
import { File } from "expo-file-system";
jest.mock("expo-file-system", () => {
  const contents = new Map<string, number>();
  class Directory {
    uri: string;
    constructor(...args: unknown[]) {
      this.uri = args.join("/");
    }
    create() {}
  }
  class File {
    uri: string;
    constructor(directory: Directory, name: string) {
      this.uri = directory.uri + "/" + name;
    }
    get exists() {
      return contents.has(this.uri);
    }
    get size() {
      return contents.get(this.uri) || 0;
    }
    delete() {
      contents.delete(this.uri);
    }
    async move(destination: File) {
      contents.set(destination.uri, this.size);
      contents.delete(this.uri);
      this.uri = destination.uri;
    }
    static downloadFileAsync = jest.fn(async (_url: string, file: File) => {
      contents.set(file.uri, 500);
      return file;
    });
  }
  return { Directory, File, Paths: { document: "file:///documents" } };
});
test("native download atomically keeps the final file after move and removes it on request", async () => {
  await saveAudio("daily-fr-2026-10-27", "https://audio.example/test", 500);
  expect(await localAudio("daily-fr-2026-10-27")).toContain(".mp3");
  await removeAudio("daily-fr-2026-10-27");
  expect(await localAudio("daily-fr-2026-10-27")).toBeNull();
});
test("partial files never become available offline", async () => {
  await expect(
    saveAudio("daily-fr-2026-10-28", "https://audio.example/test", 900),
  ).rejects.toThrow("Incomplete");
  expect(await localAudio("daily-fr-2026-10-28")).toBeNull();
  expect(File.downloadFileAsync).toHaveBeenCalled();
});
