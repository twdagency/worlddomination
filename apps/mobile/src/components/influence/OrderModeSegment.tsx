import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { OrderScreenMode } from '../../navigation/deepLinks';
import { terminal } from '../../theme/terminal';

const MODES: { id: OrderScreenMode; label: string }[] = [
  { id: 'move', label: 'Move' },
  { id: 'build', label: 'Build' },
  { id: 'influence', label: 'Influence' },
];

interface OrderModeSegmentProps {
  mode: OrderScreenMode;
  onChange: (mode: OrderScreenMode) => void;
}

export function OrderModeSegment({ mode, onChange }: OrderModeSegmentProps) {
  return (
    <View style={styles.row} testID="order-mode-segment">
      {MODES.map((entry) => {
        const active = entry.id === mode;
        return (
          <Pressable
            key={entry.id}
            onPress={() => onChange(entry.id)}
            style={[styles.chip, active && styles.chipActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            testID={`order-mode-${entry.id}`}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{entry.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    flex: 1,
    borderWidth: 1,
    borderColor: terminal.border,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
  },
  chipActive: {
    borderColor: terminal.accent,
    backgroundColor: '#102018',
  },
  label: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  labelActive: {
    color: terminal.accent,
  },
});
