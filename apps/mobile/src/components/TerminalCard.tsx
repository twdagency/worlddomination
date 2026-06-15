import React from 'react';
import { StyleSheet, Text, View, type ViewProps } from 'react-native';
import { terminal } from '../theme/terminal';

export function TerminalCard({ children, style, ...rest }: ViewProps) {
  return (
    <View style={[styles.card, style]} {...rest}>
      {children}
    </View>
  );
}

export function TerminalLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

export function TerminalValue({ children }: { children: React.ReactNode }) {
  return <Text style={styles.value}>{children}</Text>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: terminal.card,
    borderColor: terminal.border,
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
    marginBottom: 10,
  },
  label: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  value: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 14,
  },
});
