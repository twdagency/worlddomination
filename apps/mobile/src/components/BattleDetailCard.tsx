import React from 'react';
import { StyleSheet, Text } from 'react-native';
import type { BattleReport, WorldState } from 'sim';
import { TerminalCard } from './TerminalCard';
import { terminal } from '../theme/terminal';

interface Props {
  report: BattleReport;
  territoryId: string;
  world: WorldState;
}

export function BattleDetailCard({ report, territoryId, world }: Props) {
  const place = world.territories[territoryId]?.name ?? territoryId;
  const attacker = world.leaders[world.factions[report.attackerId]?.leaderId ?? '']?.name ?? report.attackerId;
  const defender = world.leaders[world.factions[report.defenderId]?.leaderId ?? '']?.name ?? report.defenderId;
  const winner = report.winnerId === report.attackerId ? attacker : defender;
  const ratio = report.defenderPower > 0 ? report.attackerPower / report.defenderPower : Infinity;

  return (
    <TerminalCard style={styles.card}>
      <Text style={styles.heading}>BATTLE — {place}</Text>
      <Text style={styles.line}>Attacker: {attacker}</Text>
      <Text style={styles.line}>Defender: {defender}</Text>
      <Text style={styles.line}>
        Power: {Math.round(report.attackerPower)} vs {Math.round(report.defenderPower)} (ratio{' '}
        {ratio === Infinity ? '∞' : ratio.toFixed(2)})
      </Text>
      <Text style={styles.line}>
        Losses: {report.attackerLosses} attacker / {report.defenderLosses} defender
      </Text>
      <Text style={styles.outcome}>Outcome: {winner} victorious</Text>
      {report.narrative ? <Text style={styles.narrative}>{report.narrative}</Text> : null}
    </TerminalCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 8,
    borderColor: terminal.danger,
  },
  heading: {
    color: terminal.danger,
    fontFamily: terminal.mono,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  line: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginBottom: 4,
  },
  outcome: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
  },
  narrative: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
});
