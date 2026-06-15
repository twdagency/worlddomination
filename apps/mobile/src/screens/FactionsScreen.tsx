import React from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { computeStance, STANCE_WINDOW_MS } from 'sim';
import { useGame } from '../game/GameContext';
import { isTimestampedDispatch } from '../game/actions';
import { TerminalCard } from '../components/TerminalCard';
import { terminal } from '../theme/terminal';

function stanceColor(stance: string): string {
  if (stance === 'Hostile') return terminal.danger;
  if (stance === 'Defensive') return terminal.warning;
  if (stance === 'Developing') return terminal.accent;
  if (stance === 'Active') return terminal.text;
  return terminal.muted;
}

export function FactionsScreen() {
  const { world, dispatches } = useGame();
  const events = dispatches.filter(isTimestampedDispatch);

  const factions = Object.values(world.factions)
    .filter((faction) => !faction.isPlayer)
    .map((faction) => {
      const leader = world.leaders[faction.leaderId];
      const stance = computeStance(world, faction.id, events, world.nowMs, STANCE_WINDOW_MS);
      return {
        id: faction.id,
        name: leader?.name ?? faction.id,
        stance,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={factions}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <Text style={styles.hint}>Posture from observed orders (last 24h)</Text>
      }
      renderItem={({ item }) => (
        <TerminalCard>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={[styles.stance, { color: stanceColor(item.stance) }]}>{item.stance}</Text>
        </TerminalCard>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: terminal.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 24,
  },
  hint: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginBottom: 12,
  },
  name: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  stance: {
    fontFamily: terminal.mono,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
