import { useEffect, useState, type PropsWithChildren } from "react";
import { AppState, TextInput, View } from "react-native";
import { useLibrary } from "../state/library";
import {
  findEdition,
  refreshCatalog,
  useCatalog,
  loadEdition,
  downloadEdition,
  removeDownload,
} from "../data/catalog";
import { voiceApi } from "../conversation/api";
import { Body, Button, s } from "./ui";
export function EditionHost() {
  useEffect(() => {
    void refreshCatalog();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshCatalog();
    });
    return () => subscription.remove();
  }, []);
  return null;
}
export function EditionStatus() {
  const { loading, error, signedOut } = useCatalog();
  const [password, setPassword] = useState("");
  const [signInError, setSignInError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      {loading && <Body>Checking for new editions…</Body>}
      {error && <Body>{error}</Body>}
      {signedOut && (
        <>
          <TextInput
            accessibilityLabel="Edition access password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            placeholder="Preview password"
            style={s.card}
          />
          <Button
            label="Unlock daily editions"
            disabled={busy || !password}
            onPress={() => {
              setBusy(true);
              setSignInError(null);
              void voiceApi
                .signIn(password)
                .then(() => {
                  setPassword("");
                  return refreshCatalog();
                })
                .catch(() =>
                  setSignInError(
                    "Could not sign in. Check the password and try again.",
                  ),
                )
                .finally(() => setBusy(false));
            }}
          />
          {signInError && <Body>{signInError}</Body>}
        </>
      )}
      {error && !signedOut && (
        <Button
          secondary
          disabled={loading}
          label="Retry loading editions"
          onPress={() => {
            void refreshCatalog();
          }}
        />
      )}
    </View>
  );
}
export function EditionGate({
  children,
  id,
}: PropsWithChildren<{ id?: string }>) {
  const active = useLibrary((s) => s.activeEpisodeId);
  const selected = id ?? active;
  useCatalog((s) => s.version);
  const [retrying, setRetrying] = useState(false);
  const [settledId, setSettledId] = useState<string | null>(null);
  const loading =
    retrying || (settledId !== selected && !findEdition(selected));
  const retry = () => {
    setRetrying(true);
    void loadEdition(selected)
      .catch(() => {})
      .finally(() => {
        setSettledId(selected);
        setRetrying(false);
      });
  };
  useEffect(() => {
    if (!findEdition(selected)) {
      let alive = true;
      void loadEdition(selected)
        .catch(() => {})
        .finally(() => {
          if (alive) setSettledId(selected);
        });
      return () => {
        alive = false;
      };
    }
  }, [selected]);
  if (findEdition(selected)) return children;
  return (
    <View style={s.content}>
      <Body>
        {loading
          ? "Loading edition…"
          : "This edition is unavailable. Your saved references are still on this device."}
      </Body>
      <EditionStatus />
      <Button label="Retry this edition" disabled={loading} onPress={retry} />
    </View>
  );
}
export function EditionDownload({ id }: { id: string }) {
  const state = useCatalog((s) => s.downloads[id]);
  return (
    <View style={{ gap: 6 }}>
      <Button
        secondary
        disabled={state === "downloading"}
        label={
          state === "downloaded"
            ? "Remove audio download"
            : state === "downloading"
              ? "Downloading audio…"
              : state === "error"
                ? "Retry audio download"
                : "Download audio for offline listening"
        }
        onPress={() => {
          void (state === "downloaded"
            ? removeDownload(id)
            : downloadEdition(id));
        }}
      />
      {state === "downloaded" && (
        <Body>Audio available offline on this device.</Body>
      )}
      {state === "error" && (
        <Body>
          Download failed. Check your connection and available storage.
        </Body>
      )}
    </View>
  );
}
