import React from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { useGame } from '../game/GameContext';
import { TerminalCard } from '../components/TerminalCard';
import { terminal } from '../theme/terminal';
import { formatDuration } from '../utils/format';

export function ForcesScreen() {
  const { world, wallNowMs } = useGame();
  const units = Object.values(world.units).filter((u) => u.ownerId === 'faction-player');

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={units}
      keyExtractor={(u) => u.id}
      extraData={wallNowMs}
      renderItem={({ item }) => {
        const unitType = world.unitTypes[item.typeId];
        const inTransit = item.transit;

        if (inTransit) {
          const destId = inTransit.toTerritoryId ?? '';
          const dest = world.territories[destId]?.name ?? destId;
          const remaining = Math.max(0, inTransit.arriveMs - wallNowMs);
          return (
            <TerminalCard>
              <Text style={styles.title}>{unitType?.name ?? item.id}</Text>
              <Text style={styles.detail}>×{item.count} · IN TRANSIT</Text>
              <Text style={styles.dest}>→ {dest}</Text>
              <Text style={styles.eta}>ETA {formatDuration(remaining)}</Text>
            </TerminalCard>
          );
        }

        const location = item.locationId
          ? (world.territories[item.locationId]?.name ?? item.locationId)
          : 'Unknown';

        return (
          <TerminalCard>
            <Text style={styles.title}>{unitType?.name ?? item.id}</Text>
            <Text style={styles.detail}>
              ×{item.count} · {location}
            </Text>
            <Text style={styles.stationed}>Stationed</Text>
          </TerminalCard>
        );
      }}
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
  title: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  detail: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 13,
  },
  dest: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 14,
    marginTop: 8,
  },
  eta: {
    color: terminal.warning,
    fontFamily: terminal.mono,
    fontSize: 13,
    marginTop: 4,
  },
  stationed: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginTop: 6,
  },
});
