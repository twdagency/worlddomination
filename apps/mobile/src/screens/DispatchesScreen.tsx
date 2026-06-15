import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useGame } from '../game/GameContext';
import { formatDispatchLine, buildDispatchFeed, isDispatchDetailEvent, isTimestampedDispatch } from '../game/actions';
import { BattleDetailCard } from '../components/BattleDetailCard';
import { DevTimeSkip } from '../components/DevTimeSkip';
import { TerminalCard } from '../components/TerminalCard';
import { terminal } from '../theme/terminal';
import { formatAwayDuration, formatDateTime, formatFunding } from '../utils/format';

function dispatchAccent(kind: string): string {
  if (kind === 'battle') return terminal.danger;
  if (kind === 'withdrawal') return terminal.warning;
  if (kind === 'secured') return terminal.accent;
  if (kind === 'income' || kind === 'production' || kind === 'buildStarted' || kind === 'infraUpgraded') return terminal.accent;
  if (kind === 'buildBlocked') return terminal.warning;
  return terminal.text;
}

export function DispatchesScreen() {
  const { world, dispatches, awayMs } = useGame();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const faction = world.factions['faction-player'];
  const recent = [...dispatches].filter(isTimestampedDispatch);
  const feed = buildDispatchFeed(world, recent, formatDispatchLine).reverse();

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
        data={feed}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <TerminalCard>
            <Text style={styles.empty}>No dispatches yet. Issue an assault order.</Text>
          </TerminalCard>
        }
        renderItem={({ item, index }) => {
          const isExpanded = expandedIndex === index;
          const showDetail = isDispatchDetailEvent(item.event) && item.event.kind === 'battle';

          return (
            <Pressable
              onPress={() =>
                setExpandedIndex(isExpanded ? null : showDetail ? index : null)
              }
            >
              <TerminalCard>
                {item.header && <Text style={styles.beatHeader}>{item.header}</Text>}
                <Text style={styles.timestamp}>{formatDateTime(item.event.at)}</Text>
                <Text style={[styles.line, { color: dispatchAccent(item.event.kind) }]}>
                  {item.line}
                </Text>
                {isExpanded && item.event.kind === 'battle' && (
                  <BattleDetailCard
                    report={item.event.report}
                    territoryId={item.event.territoryId}
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
  beatHeader: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
