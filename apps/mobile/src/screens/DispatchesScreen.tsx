import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useGame } from '../game/GameContext';
import { formatDispatchLine, isDispatchDetailEvent, isTimestampedDispatch } from '../game/actions';
import { BattleDetailCard } from '../components/BattleDetailCard';
import { DevTimeSkip } from '../components/DevTimeSkip';
import { TerminalCard } from '../components/TerminalCard';
import { terminal } from '../theme/terminal';
import { formatAwayDuration, formatDateTime, formatFunding } from '../utils/format';

function dispatchAccent(kind: string): string {
  if (kind === 'battle') return terminal.danger;
  if (kind === 'withdrawal') return terminal.warning;
  if (kind === 'secured') return terminal.accent;
  if (kind === 'income' || kind === 'production') return terminal.accent;
  if (kind === 'buildBlocked') return terminal.warning;
  return terminal.text;
}

export function DispatchesScreen() {
  const { world, dispatches, awayMs } = useGame();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const faction = world.factions['faction-player'];
  const recent = [...dispatches].filter(isTimestampedDispatch).reverse();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {awayMs > 0 && (
          <Text style={styles.away}>Away {formatAwayDuration(awayMs)}</Text>
        )}
        <Text style={styles.meta}>
          Day {world.day} · Funding {formatFunding(faction?.funding ?? 0)}
        </Text>
      </View>

      {__DEV__ && <DevTimeSkip />}

      <FlatList
        data={recent}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <TerminalCard>
            <Text style={styles.empty}>No dispatches yet. Issue an assault order.</Text>
          </TerminalCard>
        }
        renderItem={({ item, index }) => {
          const isExpanded = expandedIndex === index;
          const showDetail = isDispatchDetailEvent(item) && item.kind === 'battle';

          return (
            <Pressable
              onPress={() =>
                setExpandedIndex(isExpanded ? null : showDetail ? index : null)
              }
            >
              <TerminalCard>
                <Text style={styles.timestamp}>{formatDateTime(item.at)}</Text>
                <Text style={[styles.line, { color: dispatchAccent(item.kind) }]}>
                  {formatDispatchLine(item, world)}
                </Text>
                {isExpanded && item.kind === 'battle' && (
                  <BattleDetailCard
                    report={item.report}
                    territoryId={item.territoryId}
                    world={world}
                  />
                )}
              </TerminalCard>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: terminal.bg,
    padding: 16,
  },
  header: {
    marginBottom: 8,
  },
  away: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  meta: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 13,
  },
  list: {
    paddingTop: 12,
    paddingBottom: 24,
  },
  timestamp: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 11,
    marginBottom: 6,
  },
  line: {
    fontFamily: terminal.mono,
    fontSize: 14,
    lineHeight: 20,
  },
  empty: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 13,
  },
});
