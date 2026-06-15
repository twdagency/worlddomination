import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DashboardEmpireSummary } from '../../game/playerView';
import { TerminalCard } from '../TerminalCard';
import { terminal } from '../../theme/terminal';
import { formatFunding } from '../../utils/format';

interface EmpireSummaryProps {
  summary: DashboardEmpireSummary;
}

function resourceColor(status: 'ok' | 'low' | 'critical'): string {
  if (status === 'critical') return terminal.danger;
  if (status === 'low') return terminal.warning;
  return terminal.text;
}

export function EmpireSummary({ summary }: EmpireSummaryProps) {
  const cities =
    summary.territoryNames.length > 0 ? summary.territoryNames.join(', ') : 'No holdings';

  return (
    <TerminalCard>
      <Text style={styles.label}>Empire summary</Text>

      <View style={styles.block}>
        <Text style={styles.leader}>
          {summary.leaderName} — {summary.regionName}
        </Text>
        <Text style={styles.sub}>{cities}</Text>
      </View>

      <View style={styles.block}>
        <Text style={styles.stat}>Funding: {formatFunding(summary.funding)}</Text>
        <Text style={styles.stat}>
          Manpower: {summary.manpower.toLocaleString()} / {summary.manpowerCap.toLocaleString()}
        </Text>
        {summary.resources.map((resource) => (
          <Text
            key={resource.id}
            style={[styles.stat, { color: resourceColor(resource.status) }]}
          >
            {resource.label}: {Math.floor(resource.amount).toLocaleString()}
            {resource.status !== 'ok' ? ` (${resource.status})` : ''}
          </Text>
        ))}
      </View>

      <View style={styles.block}>
        <Text style={styles.stat}>
          Era: {summary.era} · Day {summary.gameDay}
        </Text>
        <Text style={styles.stat}>Alliances: {summary.allianceCount}</Text>
        <Text style={styles.sub}>{summary.gameDateLabel}</Text>
      </View>
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
  block: {
    marginBottom: 12,
  },
  leader: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 16,
    fontWeight: '700',
  },
  sub: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 18,
  },
  stat: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 13,
    marginBottom: 4,
  },
});
