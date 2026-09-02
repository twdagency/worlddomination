import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { terminal } from '../../theme/terminal';

interface PlayerVictoryOverlayProps {
  visible: boolean;
  countryName: string;
  onContinue: () => void;
}

export function PlayerVictoryOverlay({
  visible,
  countryName,
  onContinue,
}: PlayerVictoryOverlayProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onContinue}
      testID="player-victory-overlay"
    >
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Text style={styles.title}>Victory</Text>
          <Text style={styles.body}>
            {countryName} is the last country standing. The campaign is won — you may continue
            viewing the world.
          </Text>
          <Pressable
            style={styles.button}
            onPress={onContinue}
            accessibilityRole="button"
            accessibilityLabel="Continue viewing"
            testID="player-victory-continue"
          >
            <Text style={styles.buttonLabel}>Continue viewing</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10, 14, 20, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  panel: {
    backgroundColor: terminal.bg,
    borderColor: terminal.accent,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 10,
    padding: 18,
    gap: 12,
  },
  title: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 22,
    fontWeight: '700',
  },
  body: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 14,
    lineHeight: 22,
  },
  button: {
    alignSelf: 'flex-start',
    borderColor: terminal.accent,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
  },
  buttonLabel: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 13,
    fontWeight: '700',
  },
});
