import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useGame } from '../game/GameContext';
import { toggleExpandedRow } from '../game/expandableRowState';
import {
  isPlayerForceMovable,
  playerForces,
  resolvePlayerFactionId,
} from '../game/playerView';
import { formatTransitEndpointLabel } from '../game/territoryOwnerLabel';
import { navigateTo } from '../navigation/deepLinks';
import { ExpandableRow } from '../components/disclosure/ExpandableRow';
import { TerminalProgressBar } from '../components/TerminalProgressBar';
import { ScreenBackButton } from '../components/navigation/ScreenBackButton';
import { TerminalCard } from '../components/TerminalCard';
import { terminal } from '../theme/terminal';
import { remainingWallMs } from '../game/timeScale';
import { formatDuration } from '../utils/format';
import { transitFraction } from 'sim';

export function ForcesScreen() {
  const navigation = useNavigation();
  const { world, wallNowMs } = useGame();
  const units = playerForces(world);
  const playerId = resolvePlayerFactionId(world);
  const [expandedUnitId, setExpandedUnitId] = useState<string | null>(null);
  const rootNavigation = navigation.getParent() ?? navigation;

  const openOrderForForce = (forceId: string) => {
    navigateTo(rootNavigation as never, {
      tab: 'actions',
      screen: 'order',
      presetForceId: forceId,
    });
  };

  const openOrder = () => {
    navigateTo(rootNavigation as never, {
      tab: 'actions',
      screen: 'order',
    });
  };

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
      ListEmptyComponent={
        <TerminalCard style={styles.emptyCard}>
          <Text style={styles.emptyCopy}>No active forces. Issue an order to deploy.</Text>
          <Pressable
            onPress={openOrder}
            accessibilityRole="button"
            accessibilityLabel="Issue order"
            testID="forces-empty-issue-order"
            style={({ pressed }) => [styles.emptyAction, pressed && styles.pressed]}
          >
            <Text style={styles.emptyActionText}>Issue order →</Text>
          </Pressable>
        </TerminalCard>
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
          const remaining = remainingWallMs(world, inTransit.arriveMs);
          const progress = transitFraction(world.nowMs, inTransit);
          return (
            <View testID={`force-in-transit-${item.id}`}>
              <ExpandableRow
                rowId={item.id}
                title={label}
                subtitleContent={
                  <View>
                    <Text style={styles.rowSubtitle}>
                      ×{item.count} · IN TRANSIT {originLabel} → {destLabel}
                    </Text>
                    <TerminalProgressBar
                      progress={progress}
                      testID={`force-in-transit-progress-${item.id}`}
                    />
                  </View>
                }
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
            </View>
          );
        }

        const locationId = item.locationId;
        const locationLabel = locationId
          ? formatTransitEndpointLabel(world, locationId, 'inline', playerId)
          : 'Unknown';
        const movable = isPlayerForceMovable(world, item);

        if (movable) {
          return (
            <Pressable
              onPress={() => openOrderForForce(item.id)}
              accessibilityRole="button"
              accessibilityLabel={`Move ${label}`}
              testID={`force-movable-${item.id}`}
              style={({ pressed }) => [pressed && styles.pressed]}
            >
              <TerminalCard>
                <View style={styles.rowHeader}>
                  <View style={styles.titles}>
                    <Text style={styles.rowTitle}>{label}</Text>
                    <Text style={styles.rowSubtitle}>×{item.count} · {locationLabel}</Text>
                  </View>
                  <Text style={styles.moveAffordance}>Move →</Text>
                </View>
              </TerminalCard>
            </Pressable>
          );
        }

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
  emptyCard: {
    gap: 12,
  },
  emptyCopy: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyAction: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  emptyActionText: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 14,
    fontWeight: '700',
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    gap: 8,
  },
  titles: {
    flex: 1,
  },
  rowTitle: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 14,
    fontWeight: '700',
  },
  rowSubtitle: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  moveAffordance: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 13,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.85,
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
