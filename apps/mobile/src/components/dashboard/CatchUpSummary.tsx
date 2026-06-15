import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DashboardCatchUpSummary } from '../../game/playerView';
import { TerminalCard } from '../TerminalCard';
import { terminal } from '../../theme/terminal';
import { formatCatchUpBody, formatCatchUpHeading } from './catchUpSummaryText';

interface CatchUpSummaryProps {
  summary: DashboardCatchUpSummary;
  onOpenDispatches: () => void;
}

export function CatchUpSummary({ summary, onOpenDispatches }: CatchUpSummaryProps) {
  if (summary.mode === 'current') {
    return (
      <TerminalCard>
        <Text style={styles.label}>{formatCatchUpHeading(summary)}</Text>
        <Text style={styles.body}>{formatCatchUpBody(summary)}</Text>
      </TerminalCard>
    );
  }

  return (
    <Pressable onPress={onOpenDispatches}>
      <TerminalCard style={styles.tappable}>
        <Text style={styles.label}>{formatCatchUpHeading(summary)}</Text>
        <Text style={styles.body}>{formatCatchUpBody(summary)}</Text>
        <Text style={styles.hint}>Tap to open dispatches</Text>
      </TerminalCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tappable: {
    borderColor: terminal.accent,
  },
  label: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  body: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 13,
    lineHeight: 20,
  },
  hint: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 11,
    marginTop: 8,
  },
});
