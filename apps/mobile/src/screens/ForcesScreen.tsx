import React, { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useGame } from '../game/GameContext';
import { toggleExpandedRow } from '../game/expandableRowState';
import {
  playerForces,
  resolvePlayerFactionId,
} from '../game/playerView';
import { formatTransitEndpointLabel } from '../game/territoryOwnerLabel';
import { ExpandableRow } from '../components/disclosure/ExpandableRow';
import { ScreenBackButton } from '../components/navigation/ScreenBackButton';
import { terminal } from '../theme/terminal';
import { formatDuration } from '../utils/format';

export function ForcesScreen() {
  const { world, wallNowMs } = useGame();
  const units = playerForces(world);
  const playerId = resolvePlayerFactionId(world);
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={units}
      keyExtractor={(u) => u.id}
      extraData={wallNowMs}
      ListHeaderComponent={
        <View>
          <ScreenBackButton />
          <Text style={styles.heading}>Forces</Text>
        </View>
      }
      renderItem={({ item }) => {
        const unitType = world.unitTypes[item.typeId];
        const inTransit = item.transit;
        const label = unitType?.name ?? item.id;

        if (inTransit) {
          const destId = inTransit.toTerritoryId ?? '';
          const originId = item.locationId;
          const destLabel = formatTransitEndpointLabel(
            world,
            destId,
            'compact',
            playerId,
            undefined,
            true,
          );
          const originLabel = originId
            ? formatTransitEndpointLabel(world, originId, 'inline', playerId)
            : 'Unknown';
          const remaining = Math.max(0, inTransit.arriveMs - wallNowMs);
          return (
            <ExpandableRow
              rowId={item.id}
              title={label}
              subtitle={`×${item.count} · IN TRANSIT ${originLabel} → ${destLabel}`}
              expanded={expandedUnitId === item.id}
              highlighted
              onToggle={(id) => setExpandedUnitId((prev) => toggleExpandedRow(prev, id))}
              secondary={
                <>
                  <Text style={styles.detail}>Origin: {originLabel}</Text>
                  <Text style={styles.detail}>Destination: {destLabel}</Text>
                  <Text style={styles.eta}>ETA {formatDuration(remaining)}</Text>
                  <Text style={styles.detail}>
                    Stance: {inTransit.stanceOnArrival ?? 'hold'}
                  </Text>
                </>
              }
            />
          );
        }

        const locationId = item.locationId;
        const locationLabel = locationId
          ? formatTransitEndpointLabel(world, locationId, 'inline', playerId)
          : 'Unknown';

        return (
          <ExpandableRow
            rowId={item.id}
            title={label}
            subtitle={`×${item.count} · ${locationLabel}`}
            expanded={expandedUnitId === item.id}
            onToggle={(id) => setExpandedUnitId((prev) => toggleExpandedRow(prev, id))}
            secondary={
              <>
                <Text style={styles.detail}>Tier {unitType?.tier ?? '?'}</Text>
                <Text style={styles.detail}>Domain: {unitType?.domain ?? 'unknown'}</Text>
                <Text style={styles.stationed}>Stationed at {locationLabel}</Text>
              </>
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
  heading: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  detail: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 13,
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
