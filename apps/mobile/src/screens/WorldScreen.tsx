import React, { useEffect, useMemo, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useGame } from '../game/GameContext';
import { formatIntelAge, formatSnapshotHint } from '../game/intelDisplay';
import {
  formatWorldTerritoryCountryLine,
  formatWorldTerritoryTitle,
  selectCountryById,
  selectTerritoryCountryContext,
} from '../game/countrySelector';
import { playerWorldIntel } from '../game/playerView';
import { LinkText } from '../components/navigation/LinkText';
import { IntelSourceHint } from '../components/IntelSourceHint';
import { TerminalCard } from '../components/TerminalCard';
import { deepLinkForEntity } from '../navigation/deepLinks';
import { useDeepLinkNavigation } from '../navigation/useDeepLinkNavigation';
import { useFocusHighlight } from '../navigation/useFocusHighlight';
import type { WorldStackParamList } from '../navigation/types';
import { terminal } from '../theme/terminal';

type WorldRoute = RouteProp<WorldStackParamList, 'WorldHome'>;

function intelSubtitle(state: string, lastObservedAt: number | undefined, nowMs: number): string {
  if (state === 'unknown') return 'No intelligence';
  if (state === 'stale' && lastObservedAt !== undefined) {
    return formatIntelAge(nowMs, lastObservedAt);
  }
  return 'Live intelligence';
}

export function WorldScreen() {
  const { world } = useGame();
  const route = useRoute<WorldRoute>();
  const navigateDeep = useDeepLinkNavigation();
  const listRef = useRef<FlatList>(null);

  const focusTerritoryId = route.params?.focusTerritoryId;
  const focusCountryId = route.params?.focusCountryId;
  const highlightedId = useFocusHighlight(focusTerritoryId ?? focusCountryId);

  const allEntries = playerWorldIntel(world);
  const entries = useMemo(() => {
    if (!focusCountryId) return allEntries;
    return allEntries.filter((item) => {
      const ownerId =
        item.snapshot?.ownerId ?? world.territories[item.territoryId]?.ownerId;
      return ownerId === focusCountryId;
    });
  }, [allEntries, focusCountryId, world.territories]);

  const focusCountry = focusCountryId ? selectCountryById(world, focusCountryId) : null;

  useEffect(() => {
    if (!focusTerritoryId) return;
    const index = entries.findIndex((item) => item.territoryId === focusTerritoryId);
    if (index < 0) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
    }, 100);
    return () => clearTimeout(timer);
  }, [entries, focusTerritoryId]);

  return (
    <FlatList
      ref={listRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      data={entries}
      keyExtractor={(item) => item.territoryId}
      onScrollToIndexFailed={() => {
        // Layout may not be ready on first paint.
      }}
      ListHeaderComponent={
        <View>
          <Text style={styles.hint}>
            Regional awareness — tap a territory to manage or inspect holdings. Summary view;
            production and builds stay on Territory.
          </Text>
          {focusCountry ? (
            <View style={styles.filterBanner} testID="world-country-filter-banner">
              <Text style={styles.filterText}>
                Showing {focusCountry.name} territories
              </Text>
              <LinkText
                testID="world-clear-country-filter"
                onPress={() => navigateDeep({ tab: 'world' })}
              >
                Clear filter
              </LinkText>
            </View>
          ) : null}
        </View>
      }
      renderItem={({ item }) => {
        const isUnknown = item.state === 'unknown';
        const isStale = item.state === 'stale';
        const ownerId = item.snapshot?.ownerId ?? world.territories[item.territoryId]?.ownerId;
        const countryContext = selectTerritoryCountryContext(world, item.territoryId, ownerId);
        const displayName = isUnknown
          ? '???'
          : countryContext
            ? formatWorldTerritoryTitle(countryContext)
            : item.name;
        const countryLine = countryContext
          ? formatWorldTerritoryCountryLine(countryContext)
          : item.ownerAffiliation;
        const countryName = countryContext?.country?.name;
        const isFocused =
          highlightedId === item.territoryId ||
          (focusCountryId !== undefined && ownerId === focusCountryId);

        return (
          <Pressable
            onPress={() => {
              const target = deepLinkForEntity({ kind: 'territory', id: item.territoryId });
              if (target) navigateDeep(target);
            }}
            testID={`world-territory-row-${item.territoryId}`}
          >
            <TerminalCard
              style={[
                isStale ? styles.staleCard : undefined,
                isFocused ? styles.focusFlash : undefined,
              ]}
            >
              <View style={styles.rowHeader}>
                <View style={styles.titles}>
                  <LinkText
                    testID={`world-territory-link-${item.territoryId}`}
                    onPress={() => {
                      const target = deepLinkForEntity({ kind: 'territory', id: item.territoryId });
                      if (target) navigateDeep(target);
                    }}
                  >
                    {displayName}
                  </LinkText>
                  <Text style={styles.intelLine}>
                    {intelSubtitle(item.state, item.lastObservedAt, world.nowMs)}
                  </Text>
                  {countryName && countryContext?.country ? (
                    <View style={styles.countryLine}>
                      <LinkText
                        testID={`world-country-link-${countryContext.country.id}`}
                        onPress={() => {
                          const target = deepLinkForEntity({
                            kind: 'country',
                            id: countryContext.country!.id,
                          });
                          if (target) navigateDeep(target);
                        }}
                      >
                        {countryName}
                      </LinkText>
                      <Text style={styles.countrySuffix}>
                        {' '}
                        — led by {countryContext.country.leaderName}
                      </Text>
                    </View>
                  ) : countryLine ? (
                    <Text style={styles.subtitle}>{countryLine}</Text>
                  ) : null}
                </View>
              </View>
              {isUnknown ? (
                <Text style={styles.unknownSub}>No intelligence on this region.</Text>
              ) : null}
              {isStale && item.snapshot ? (
                <Text style={styles.snapshot}>{formatSnapshotHint(item.snapshot)}</Text>
              ) : null}
              {item.state !== 'unknown' ? <IntelSourceHint sources={item.sources} /> : null}
              {item.lastObservedAt !== undefined ? (
                <Text style={styles.tertiary}>
                  Last observed: {formatIntelAge(world.nowMs, item.lastObservedAt)}
                </Text>
              ) : null}
            </TerminalCard>
          </Pressable>
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
    gap: 12,
  },
  hint: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginBottom: 12,
    lineHeight: 18,
  },
  filterBanner: {
    borderColor: terminal.accent,
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    marginBottom: 12,
    gap: 6,
  },
  filterText: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 13,
    fontWeight: '700',
  },
  rowHeader: {
    minHeight: 44,
  },
  titles: {
    gap: 4,
  },
  intelLine: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
  },
  countryLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  countrySuffix: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    lineHeight: 16,
  },
  subtitle: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    lineHeight: 16,
  },
  staleCard: {
    borderColor: terminal.stale,
  },
  focusFlash: {
    borderColor: terminal.tutorial,
    backgroundColor: '#142218',
  },
  unknownSub: {
    color: terminal.muted,
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
  tertiary: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 6,
  },
});
