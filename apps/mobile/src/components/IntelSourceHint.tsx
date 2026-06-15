import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { formatIntelSourceLabel } from 'sim';
import { terminal } from '../theme/terminal';

/** Renders provenance when non-direct sources contribute. Hidden for direct-only intel. */
export function IntelSourceHint({ sources }: { sources: IntelSource[] }) {
  const label = formatIntelSourceLabel(sources);
  if (!label) return null;

  return <Text style={styles.hint}>{label}</Text>;
}

const styles = StyleSheet.create({
  hint: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 11,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
