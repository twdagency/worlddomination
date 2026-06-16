import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { nextEventMs } from 'sim';
import { useGame } from '../game/GameContext';
import { showDevControls } from '../game/devFlag';
import { terminal } from '../theme/terminal';

export function DevTimeSkip() {
  if (!showDevControls) return null;

  const { world, skipNext } = useGame();
  const hasNext = nextEventMs(world) !== null;

  return (
    <Pressable
      style={[styles.button, !hasNext && styles.disabled]}
      onPress={() => void skipNext()}
      disabled={!hasNext}
    >
      <Text style={styles.text}>
        {hasNext ? '[DEV] Skip to next event' : '[DEV] No pending events'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: terminal.border,
    borderColor: terminal.accent,
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginTop: 8,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 13,
    textAlign: 'center',
  },
});
