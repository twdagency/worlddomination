import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { resolveEventImportance } from 'sim';
import { useGame } from '../game/GameContext';
import {
  buildDisplayDispatchFeed,
  isDispatchDetailEvent,
  isTimestampedDispatch,
} from '../game/actions';
import { showDevControls } from '../game/devFlag';
import { DevTimeSkip } from '../components/DevTimeSkip';
import { DevScenarioSelector } from '../components/DevScenarioSelector';
import { DispatchFeedRow } from '../components/dispatches/DispatchFeedRow';
import { ScreenBackButton } from '../components/navigation/ScreenBackButton';
import { ScrollFadeFooter } from '../components/ScrollFadeFooter';
import { TerminalCard } from '../components/TerminalCard';
import type { HomeStackParamList } from '../navigation/types';
import { terminal } from '../theme/terminal';

type DispatchesRoute = RouteProp<HomeStackParamList, 'Dispatches'>;

export function DispatchesScreen() {
  const { world, dispatches, awayMs } = useGame();
  const route = useRoute<DispatchesRoute>();
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const listRef = useRef<FlatList>(null);

  const recent = [...dispatches].filter(isTimestampedDispatch);
  const feed = useMemo(() => {
    const items = buildDisplayDispatchFeed(world, recent, awayMs).reverse();
    if (!route.params?.unreadOnly) return items;
    return items.filter((item) => resolveEventImportance(world, item.event) === 'high');
  }, [world, recent, awayMs, route.params?.unreadOnly]);

  const highlightIndex = useMemo(() => {
    const dispatchId = route.params?.dispatchId;
    if (!dispatchId) return -1;
    return feed.findIndex((item) => item.event.eventId === dispatchId);
  }, [feed, route.params?.dispatchId]);

  useEffect(() => {
    if (highlightIndex < 0) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index: highlightIndex, animated: true, viewPosition: 0.3 });
    }, 100);
    return () => clearTimeout(timer);
  }, [highlightIndex]);

  return (
    <View style={styles.container}>
      <ScreenBackButton label="Home" />
      <Text style={styles.heading}>Dispatches</Text>

      {showDevControls && <DevScenarioSelector />}
      {showDevControls && <DevTimeSkip />}

      <View style={styles.listWrap}>
        <FlatList
          ref={listRef}
          data={feed}
          keyExtractor={(item) => item.event.eventId}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator
          persistentScrollbar
          onScrollToIndexFailed={() => {
            // FlatList layout may not be ready on first paint.
          }}
          ListEmptyComponent={
            <TerminalCard>
              <Text style={styles.empty}>No dispatches yet. Issue an assault order.</Text>
            </TerminalCard>
          }
          renderItem={({ item, index }) => {
            const isExpanded = expandedIndex === index;
            const showDetail = isDispatchDetailEvent(item.event) && item.event.kind === 'battle';

            return (
              <DispatchFeedRow
                item={item}
                world={world}
                expanded={isExpanded}
                highlighted={index === highlightIndex}
                onPress={() =>
                  setExpandedIndex(isExpanded ? null : showDetail ? index : null)
                }
              />
            );
          }}
        />
        <ScrollFadeFooter testID="dispatches-scroll-fade" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: terminal.bg,
    padding: 16,
  },
  heading: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  listWrap: {
    flex: 1,
    position: 'relative',
  },
  list: {
    paddingTop: 12,
    paddingBottom: 24,
  },
  empty: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 13,
  },
});
