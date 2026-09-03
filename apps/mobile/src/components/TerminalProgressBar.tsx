import React from 'react';
import { StyleSheet, View } from 'react-native';
import { terminal } from '../theme/terminal';

interface TerminalProgressBarProps {
  progress: number;
  testID?: string;
}

export function TerminalProgressBar({ progress, testID }: TerminalProgressBarProps) {
  const fraction = Math.min(1, Math.max(0, progress));

  return (
    <View style={styles.track} testID={testID} accessibilityRole="progressbar">
      <View style={[styles.fill, { flex: fraction }]} />
      <View style={{ flex: 1 - fraction }} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: terminal.border,
    borderRadius: 2,
    flexDirection: 'row',
    height: 4,
    marginTop: 6,
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    backgroundColor: terminal.accent,
    borderRadius: 2,
    minWidth: 0,
  },
});
