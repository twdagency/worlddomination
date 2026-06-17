import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DashboardActiveForcesSummary } from '../../game/playerView';
import { TerminalCard } from '../TerminalCard';
import { terminal } from '../../theme/terminal';

interface ActiveForcesCardProps {
  summary: DashboardActiveForcesSummary;
}

export function ActiveForcesCard({ summary }: ActiveForcesCardProps) {
  return (
    <TerminalCard testID="dashboard-active-forces">
      <Text style={styles.label}>Active Forces</Text>
      <Text style={styles.stat}>
        {summary.inTransitCount} in transit · {summary.stationedCount} stationed
      </Text>
      {summary.items.length === 0 ? (
        <Text style={styles.muted}>No forces in transit.</Text>
      ) : (
        summary.items.map((item) => (
          <View key={item.unitId} style={styles.row}>
            <Text style={styles.unitLabel}>{item.label}</Text>
            <Text style={styles.unitDetail}>{item.detail}</Text>
          </View>
        ))
      )}
    </TerminalCard>
  );
}

const styles = StyleSheet.create({
  label: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  stat: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 13,
    marginBottom: 8,
  },
  muted: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 13,
  },
  row: {
    borderTopColor: terminal.border,
    borderTopWidth: 1,
    paddingTop: 8,
    marginTop: 8,
  },
  unitLabel: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 13,
    fontWeight: '700',
  },
  unitDetail: {
    color: terminal.warning,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginTop: 2,
  },
});
