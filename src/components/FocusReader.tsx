import { Modal, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { TranscriptSegment, WordToken } from "../domain/types";
import { IconButton } from "./IconButton";
import { PhraseReader } from "./PhraseReader";
import { Button, colors, s } from "./ui";

export function FocusReader({
  visible,
  returnLabel = "Full transcript",
  onClose,
  onWord,
}: {
  visible: boolean;
  returnLabel?: string;
  onClose: () => void;
  onWord: (word: WordToken, segment: TranscriptSegment) => void;
}) {
  return (
    <Modal visible={visible} animationType="none" onRequestClose={onClose}>
      {visible && (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
          <View
            accessibilityViewIsModal
            style={{
              flex: 1,
              width: "100%",
              maxWidth: 680,
              alignSelf: "center",
              padding: 16,
              gap: 8,
            }}
          >
            <View style={s.row}>
              <Text accessibilityRole="header" style={s.subheading}>
                Focus reader
              </Text>
              <IconButton
                icon="close"
                label="Close focus reader"
                onPress={onClose}
              />
            </View>
            <PhraseReader onWord={onWord} />
            <Button
              secondary
              label={
                returnLabel === "Full transcript"
                  ? "Return to full transcript"
                  : returnLabel
              }
              onPress={onClose}
            />
          </View>
        </SafeAreaView>
      )}
    </Modal>
  );
}
