import React, { useState } from 'react';
import { FlatList, StyleSheet, Text } from 'react-native';
import { useGame } from '../game/GameContext';
import { toggleExpandedRow } from '../game/expandableRowState';
import {
  getPlayerKnownTerritoryName,
  playerForces,
} from '../game/playerView';
import { ExpandableRow } from '../components/disclosure/ExpandableRow';
import { terminal } from '../theme/terminal';
import { formatDuration } from '../utils/format';

export function ForcesScreen() {
  const { world, wallNowMs } = useGame();
  const units = playerForces(world);
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={units}
      keyExtractor={(u) => u.id}
      extraData={wallNowMs}
      ListHeaderComponent={<Text style={styles.heading}>Forces</Text>}
      renderItem={({ item }) => {
        const unitType = world.unitTypes[item.typeId];
        const inTransit = item.transit;
        const label = unitType?.name ?? item.id;

        if (inTransit) {
          const destId = inTransit.toTerritoryId ?? '';
          const dest = getPlayerKnownTerritoryName(world, destId);
          const remaining = Math.max(0, inTransit.arriveMs - wallNowMs);
          return (
            <ExpandableRow
              rowId={item.id}
              title={label}
              subtitle={`×${item.count} · IN TRANSIT → ${dest}`}
              expanded={expandedUnitId === item.id}
              highlighted
              onToggle={(id) => setExpandedUnitId((prev) => toggleExpandedRow(prev, id))}
              secondary={
                <>
                  <Text style={styles.detail}>Destination: {dest}</Text>
                  <Text style={styles.eta}>ETA {formatDuration(remaining)}</Text>
                  <Text style={styles.detail}>
                    Stance: {inTransit.stanceOnArrival ?? 'hold'}
                  </Text>
                </>
              }
            />
          );
        }

        const location = item.locationId
          ? getPlayerKnownTerritoryName(world, item.locationId)
          : 'Unknown';

        return (
          <ExpandableRow
            rowId={item.id}
            title={label}
            subtitle={`×${item.count} · ${location}`}
            expanded={expandedUnitId === item.id}
            onToggle={(id) => setExpandedUnitId((prev) => toggleExpandedRow(prev, id))}
            secondary={
              <>
                <Text style={styles.detail}>Tier {unitType?.tier ?? '?'}</Text>
                <Text style={styles.detail}>Domain: {unitType?.domain ?? 'unknown'}</Text>
                <Text style={styles.stationed}>Stationed at {location}</Text>
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
