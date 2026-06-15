import React from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { useGame } from '../game/GameContext';
import { formatIntelAge, formatSnapshotHint } from '../game/intelDisplay';
import { playerWorldIntel } from '../game/playerView';
import { IntelSourceHint } from '../components/IntelSourceHint';
import { TerminalCard } from '../components/TerminalCard';
import { terminal } from '../theme/terminal';

export function WorldScreen() {
  const { world } = useGame();
  const entries = playerWorldIntel(world);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={entries}
      keyExtractor={(item) => item.territoryId}
      ListHeaderComponent={
        <Text style={styles.hint}>
          Regional awareness — live, stale, and unknown territories. Summary view; per-territory
          detail stays on Territory.
        </Text>
      }
      renderItem={({ item }) => {
        const isUnknown = item.state === 'unknown';
        const isStale = item.state === 'stale';

        return (
          <TerminalCard
            style={[
              isUnknown && styles.unknownCard,
              isStale && styles.staleCard,
            ]}
          >
            <Text
              style={[
                styles.name,
                isUnknown && styles.unknownName,
                isStale && styles.staleName,
              ]}
            >
              {isUnknown ? '???' : item.name}
            </Text>

            {isUnknown && <Text style={styles.unknownSub}>No intelligence</Text>}

            {isStale && item.lastObservedAt !== undefined && (
              <Text style={styles.staleAge}>
                {formatIntelAge(world.nowMs, item.lastObservedAt)}
              </Text>
            )}

            {isStale && item.snapshot && (
              <Text style={styles.snapshot}>{formatSnapshotHint(item.snapshot)}</Text>
            )}

            {item.state !== 'unknown' && <IntelSourceHint sources={item.sources} />}
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
  hint: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 18,
  },
  name: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 15,
    fontWeight: '700',
  },
  staleName: {
    color: terminal.stale,
  },
  unknownName: {
    color: terminal.muted,
  },
  unknownCard: {
    opacity: 0.65,
    borderStyle: 'dashed',
  },
  staleCard: {
    borderColor: terminal.stale,
  },
  unknownSub: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginTop: 4,
  },
  staleAge: {
    color: terminal.stale,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginTop: 6,
  },
  snapshot: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginTop: 4,
  },
});
