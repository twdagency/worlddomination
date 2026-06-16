import React, { useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { useGame } from '../game/GameContext';
import { formatIntelAge, formatSnapshotHint } from '../game/intelDisplay';
import {
  formatWorldTerritoryCountryLine,
  formatWorldTerritoryTitle,
  selectTerritoryCountryContext,
} from '../game/countrySelector';
import { toggleExpandedRow } from '../game/expandableRowState';
import { playerWorldIntel } from '../game/playerView';
import { ExpandableRow } from '../components/disclosure/ExpandableRow';
import { IntelSourceHint } from '../components/IntelSourceHint';
import { terminal } from '../theme/terminal';

function intelSubtitle(state: string, lastObservedAt: number | undefined, nowMs: number): string {
  if (state === 'unknown') return 'No intelligence';
  if (state === 'stale' && lastObservedAt !== undefined) {
    return formatIntelAge(nowMs, lastObservedAt);
  }
  return 'Live intelligence';
}

export function WorldScreen() {
  const { world } = useGame();
  const entries = playerWorldIntel(world);
  const [expandedTerritoryId, setExpandedTerritoryId] = useState<string | null>(null);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={entries}
      keyExtractor={(item) => item.territoryId}
      ListHeaderComponent={
        <Text style={styles.hint}>
          Regional awareness — tap a territory for intel detail. Summary view; production and
          builds stay on Territory.
        </Text>
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
        const subtitleParts = [intelSubtitle(item.state, item.lastObservedAt, world.nowMs)];
        const countryLine = countryContext
          ? formatWorldTerritoryCountryLine(countryContext)
          : item.ownerAffiliation;
        if (countryLine) {
          subtitleParts.push(countryLine);
        }

        return (
          <ExpandableRow
            rowId={item.territoryId}
            title={displayName}
            subtitle={subtitleParts.join(' · ')}
            expanded={expandedTerritoryId === item.territoryId}
            highlighted={isStale}
            onToggle={(id) => setExpandedTerritoryId((prev) => toggleExpandedRow(prev, id))}
            secondary={
              <>
                {isUnknown && <Text style={styles.unknownSub}>No intelligence on this region.</Text>}
                {isStale && item.snapshot && (
                  <Text style={styles.snapshot}>{formatSnapshotHint(item.snapshot)}</Text>
                )}
                {item.state !== 'unknown' && <IntelSourceHint sources={item.sources} />}
              </>
            }
            tertiary={
              item.lastObservedAt !== undefined ? (
                <Text style={styles.tertiary}>
                  Last observed: {formatIntelAge(world.nowMs, item.lastObservedAt)}
                </Text>
              ) : undefined
            }
          />
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
  unknownSub: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
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
  },
});
