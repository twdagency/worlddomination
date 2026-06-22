import React, { useEffect, useMemo, useRef } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import { useGame } from '../game/GameContext';
import { formatIntelAge, formatSnapshotHint } from '../game/intelDisplay';
import {
  formatWorldTerritoryCountryLine,
  formatWorldTerritoryTitle,
  selectActiveCountries,
  selectCountryById,
  selectTerritoryCountryContext,
} from '../game/countrySelector';
import {
  formatDefeatedTerritoryLine,
  selectDefeatedWorldTerritories,
} from '../game/defeatedCountrySelector';
import { playerWorldIntel } from '../game/playerView';
import { resolvePlayerFactionId } from 'shared';
import {
  selectCityInfluence,
  formatThresholdStars,
} from '../game/influenceSelector';
import {
  formatFoggedActorInfluence,
  formatInfluenceValue,
} from '../game/influenceDisplay';
import { DefeatedCountryBadge } from '../components/country/DefeatedCountryBadge';
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
  const playerId = resolvePlayerFactionId(world);
  const route = useRoute<WorldRoute>();
  const navigateDeep = useDeepLinkNavigation();
  const listRef = useRef<FlatList>(null);

  const focusTerritoryId = route.params?.focusTerritoryId;
  const focusCountryId = route.params?.focusCountryId;
  const territoryFilter = route.params?.territoryFilter;
  const showDefeatedFilter = territoryFilter === 'defeated';
  const highlightedId = useFocusHighlight(focusTerritoryId ?? focusCountryId);

  const allEntries = playerWorldIntel(world);
  const defeatedTerritories = useMemo(() => selectDefeatedWorldTerritories(world), [world]);
  const activeCountries = useMemo(() => selectActiveCountries(world), [world]);

  const entries = useMemo(() => {
    if (showDefeatedFilter) return [];
    if (!focusCountryId) return allEntries;
    return allEntries.filter((item) => {
      const ownerId =
        item.snapshot?.ownerId ?? world.territories[item.territoryId]?.ownerId;
      return ownerId === focusCountryId;
    });
  }, [allEntries, focusCountryId, showDefeatedFilter, world.territories]);

  const focusCountry = focusCountryId ? selectCountryById(world, focusCountryId) : null;

  useEffect(() => {
    if (!focusTerritoryId || showDefeatedFilter) return;
    const index = entries.findIndex((item) => item.territoryId === focusTerritoryId);
    if (index < 0) return;
    const timer = setTimeout(() => {
      listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.3 });
    }, 100);
    return () => clearTimeout(timer);
  }, [entries, focusTerritoryId, showDefeatedFilter]);

  const filterChips = (
    <View style={styles.filterRow}>
      <Pressable
        style={[styles.chip, !focusCountryId && !showDefeatedFilter && styles.chipActive]}
        onPress={() => navigateDeep({ tab: 'world' })}
        testID="world-filter-all"
      >
        <Text style={styles.chipLabel}>All</Text>
      </Pressable>
      {activeCountries.map((country) => (
        <Pressable
          key={country.id}
          style={[styles.chip, focusCountryId === country.id && styles.chipActive]}
          onPress={() => navigateDeep({ tab: 'world', focusCountryId: country.id })}
          testID={`world-filter-country-${country.id}`}
        >
          <Text style={styles.chipLabel}>{country.name}</Text>
        </Pressable>
      ))}
      <Pressable
        style={[styles.chip, showDefeatedFilter && styles.chipActive]}
        onPress={() => navigateDeep({ tab: 'world', territoryFilter: 'defeated' })}
        testID="world-filter-defeated"
      >
        <Text style={styles.chipLabel}>Defeated</Text>
      </Pressable>
    </View>
  );

  if (showDefeatedFilter) {
    return (
      <FlatList
        ref={listRef}
        style={styles.container}
        contentContainerStyle={styles.content}
        data={defeatedTerritories}
        keyExtractor={(item) => item.territoryId}
        ListHeaderComponent={
          <View>
            <Text style={styles.hint}>
              Defeated powers — territories annotated with conqueror and former owner.
            </Text>
            {filterChips}
            <View style={styles.filterBanner} testID="world-defeated-filter-banner">
              <Text style={styles.filterText}>Showing defeated country territories</Text>
              <LinkText
                testID="world-clear-defeated-filter"
                onPress={() => navigateDeep({ tab: 'world' })}
              >
                Clear filter
              </LinkText>
            </View>
          </View>
        }
        ListEmptyComponent={
          <TerminalCard>
            <Text style={styles.subtitle}>No defeated country territories to display.</Text>
          </TerminalCard>
        }
        renderItem={({ item }) => (
          <TerminalCard style={styles.defeatedCard} testID={`world-defeated-row-${item.territoryId}`}>
            <View style={styles.defeatedTitleRow}>
              <Text style={styles.defeatedTitle}>{formatDefeatedTerritoryLine(item)}</Text>
              <DefeatedCountryBadge />
            </View>
            <Pressable
              onPress={() => {
                const target = deepLinkForEntity({ kind: 'territory', id: item.territoryId });
                if (target) navigateDeep(target);
              }}
              testID={`world-defeated-territory-link-${item.territoryId}`}
            >
              <Text style={styles.defeatedLink}>Inspect territory →</Text>
            </Pressable>
          </TerminalCard>
        )}
      />
    );
  }

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
          {filterChips}
          {focusCountry ? (
            <View style={styles.filterBanner} testID="world-country-filter-banner">
              <Text style={styles.filterText}>Showing {focusCountry.name} territories</Text>
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
        const cityInfluence =
          !isUnknown && playerId ? selectCityInfluence(world, item.territoryId, playerId) : null;
        const playerOwnsCity = ownerId === playerId;
        const stars =
          cityInfluence && cityInfluence.playerInfluence > 0
            ? formatThresholdStars(cityInfluence.playerInfluence)
            : '';

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
                        {countryContext.country.defeated ? ' (defeated)' : ''}
                      </Text>
                      {countryContext.country.defeated ? (
                        <View style={styles.badgeWrap}>
                          <DefeatedCountryBadge />
                        </View>
                      ) : null}
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
              {!isUnknown && cityInfluence && !playerOwnsCity ? (
                <View testID={`world-influence-${item.territoryId}`}>
                  {cityInfluence.playerInfluence > 0 ? (
                    <Text style={styles.influenceLine}>
                      Influence: {formatInfluenceValue(cityInfluence.playerInfluence)}
                      {stars ? ` ${stars}` : ''}
                    </Text>
                  ) : null}
                  {cityInfluence.competingActors.map((actor) => (
                    <Text key={actor.actorId} style={styles.influenceFog}>
                      {formatFoggedActorInfluence(actor.actorName, actor.visibleMagnitude)}
                    </Text>
                  ))}
                </View>
              ) : null}
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    borderColor: terminal.border,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipActive: {
    borderColor: terminal.accent,
    backgroundColor: '#142218',
  },
  chipLabel: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 11,
    fontWeight: '700',
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
  badgeWrap: {
    marginLeft: 6,
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
  influenceLine: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginTop: 6,
    fontWeight: '700',
  },
  influenceFog: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginTop: 2,
  },
  defeatedCard: {
    opacity: 0.8,
    borderColor: terminal.stale,
  },
  defeatedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  defeatedTitle: {
    flex: 1,
    color: terminal.stale,
    fontFamily: terminal.mono,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  defeatedLink: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginTop: 8,
    fontWeight: '700',
  },
});
