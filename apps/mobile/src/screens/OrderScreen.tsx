import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { TransitOrder } from 'sim';
import { moveDistanceKm, previewMoveEtaMs } from 'sim';
import { useGame } from '../game/GameContext';
import { formatIntelAge } from '../game/intelDisplay';
import { ActionFeedbackBanner } from '../components/feedback/ActionFeedbackBanner';
import {
  getPlayerVisibleTerritory,
  ownerIdForIntelDisplay,
  playerMovableUnits,
  playerOrderDestinations,
  PLAYER_FACTION_ID,
} from '../game/playerView';
import { IntelSourceHint } from '../components/IntelSourceHint';
import { TerminalCard } from '../components/TerminalCard';
import { terminal } from '../theme/terminal';
import {
  formatDateTime,
  formatDistance,
  formatDuration,
  formatSpeed,
} from '../utils/format';

const STANCES: { id: TransitOrder['stanceOnArrival']; label: string; hint: string }[] = [
  { id: 'assault', label: 'Assault', hint: 'Attack hostile garrison on arrival' },
  { id: 'secure', label: 'Secure', hint: 'Occupy neutral ground only' },
  { id: 'hold', label: 'Hold', hint: 'Arrive without initiating assault' },
];

export function OrderScreen() {
  const { world, confirmMove, actionFeedback } = useGame();
  const movableUnits = playerMovableUnits(world);

  const [unitId, setUnitId] = useState(movableUnits[0]?.id ?? '');
  const [destinationId, setDestinationId] = useState<string>('');
  const [stance, setStance] = useState<TransitOrder['stanceOnArrival']>('assault');

  const unit = movableUnits.find((u) => u.id === unitId);
  const availableDestinations = useMemo(
    () => playerOrderDestinations(world, unit?.locationId),
    [world, unit?.locationId],
  );

  useEffect(() => {
    if (availableDestinations.length === 0) {
      setDestinationId('');
      return;
    }
    setDestinationId((prev) =>
      availableDestinations.some((t) => t.territoryId === prev)
        ? prev
        : availableDestinations[0].territoryId,
    );
  }, [unitId, availableDestinations]);

  const selectedDestination = availableDestinations.find((t) => t.territoryId === destinationId);

  const preview = useMemo(() => {
    if (!unitId || !destinationId || !unit?.locationId) return null;
    if (unit.locationId === destinationId) return null;
    return previewMoveEtaMs(world, unitId, destinationId);
  }, [world, unitId, destinationId, unit?.locationId]);

  const fromName = unit?.locationId
    ? getPlayerVisibleTerritory(world, unit.locationId)?.name
    : undefined;
  const toName = selectedDestination?.name;
  const distance =
    unitId && destinationId && unit?.locationId !== destinationId
      ? moveDistanceKm(world, unitId, destinationId)
      : null;
  const destOwner = selectedDestination
    ? ownerIdForIntelDisplay(world, selectedDestination)
    : undefined;
  const isHostile = destOwner && destOwner !== PLAYER_FACTION_ID;

  const canConfirm = Boolean(
    unitId &&
      destinationId &&
      unit?.locationId &&
      unit.locationId !== destinationId &&
      preview &&
      distance !== null &&
      distance > 0,
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Issue Move Order</Text>

      <ActionFeedbackBanner action="move" feedback={actionFeedback} />

      <Text style={styles.section}>Force</Text>
      {movableUnits.length === 0 ? (
        <TerminalCard>
          <Text style={styles.muted}>No forces available to deploy.</Text>
        </TerminalCard>
      ) : (
        movableUnits.map((u) => {
          const label = world.unitTypes[u.typeId]?.name ?? u.id;
          const selected = u.id === unitId;
          return (
            <Pressable key={u.id} onPress={() => setUnitId(u.id)}>
              <TerminalCard style={selected ? styles.selected : undefined}>
                <Text style={styles.optionTitle}>{label}</Text>
                <Text style={styles.optionSub}>×{u.count}</Text>
              </TerminalCard>
            </Pressable>
          );
        })
      )}

      <Text style={styles.section}>Destination</Text>
      {availableDestinations.length === 0 ? (
        <TerminalCard>
          <Text style={styles.muted}>No valid destinations — force is not stationed for redeployment.</Text>
        </TerminalCard>
      ) : (
        availableDestinations.map((destination) => {
          const hostile =
            ownerIdForIntelDisplay(world, destination) &&
            ownerIdForIntelDisplay(world, destination) !== PLAYER_FACTION_ID;
          const selected = destination.territoryId === destinationId;
          const isStale = destination.state === 'stale';

          return (
            <Pressable key={destination.territoryId} onPress={() => setDestinationId(destination.territoryId)}>
              <TerminalCard
                style={[
                  selected ? styles.selected : undefined,
                  isStale ? styles.staleCard : undefined,
                ]}
              >
                <Text style={[styles.optionTitle, isStale && styles.staleTitle]}>
                  {destination.name}
                  {hostile ? ' [HOSTILE]' : ''}
                </Text>
                {isStale && destination.lastObservedAt !== undefined && (
                  <Text style={styles.staleSub}>
                    {formatIntelAge(world.nowMs, destination.lastObservedAt)}
                  </Text>
                )}
                <IntelSourceHint sources={destination.sources} />
              </TerminalCard>
            </Pressable>
          );
        })
      )}

      <Text style={styles.section}>Stance on arrival</Text>
      {STANCES.map((s) => (
        <Pressable key={s.id} onPress={() => setStance(s.id)}>
          <TerminalCard style={stance === s.id ? styles.selected : undefined}>
            <Text style={styles.optionTitle}>{s.label}</Text>
            <Text style={styles.optionSub}>{s.hint}</Text>
          </TerminalCard>
        </Pressable>
      ))}

      {preview && distance !== null && fromName && toName && (
        <TerminalCard>
          <Text style={styles.route}>
            Route: {fromName} → {toName}
          </Text>
          <Text style={styles.route}>Distance: {formatDistance(distance)}</Text>
          <Text style={styles.route}>Speed: {formatSpeed(preview.speedKmh)}</Text>
          <Text style={styles.eta}>ETA: {formatDuration(preview.travelMs)}</Text>
          <Text style={styles.arrival}>Arrival: {formatDateTime(preview.etaMs)}</Text>
          {selectedDestination?.state === 'stale' && selectedDestination.lastObservedAt !== undefined && (
            <Text style={styles.staleWarning}>
              Acting on stale intelligence ({formatIntelAge(world.nowMs, selectedDestination.lastObservedAt)}).
            </Text>
          )}
          {isHostile && stance === 'assault' && (
            <Text style={styles.combatHint}>⚔ Assault will engage hostile garrison on arrival.</Text>
          )}
        </TerminalCard>
      )}

      <View style={styles.warning}>
        <Text style={styles.warningText}>
          ⚠ Forces cannot be recalled instantly once deployed. Outpowered assaults take
          heavy casualties — there is no automatic retreat.
        </Text>
      </View>

      <Pressable
        style={[styles.confirm, !canConfirm && styles.confirmDisabled]}
        disabled={!canConfirm}
        onPress={() => void confirmMove(unitId, destinationId, stance)}
      >
        <Text style={styles.confirmText}>Confirm Departure</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: terminal.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  heading: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  section: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 8,
  },
  selected: {
    borderColor: terminal.accent,
  },
  staleCard: {
    borderColor: terminal.stale,
  },
  optionTitle: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 14,
  },
  staleTitle: {
    color: terminal.stale,
  },
  optionSub: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginTop: 2,
  },
  staleSub: {
    color: terminal.stale,
    fontFamily: terminal.mono,
    fontSize: 11,
    marginTop: 4,
  },
  muted: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 13,
  },
  route: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 13,
    marginBottom: 4,
  },
  eta: {
    color: terminal.warning,
    fontFamily: terminal.mono,
    fontSize: 14,
    marginTop: 6,
    fontWeight: '700',
  },
  arrival: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginTop: 4,
  },
  staleWarning: {
    color: terminal.stale,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 18,
  },
  combatHint: {
    color: terminal.danger,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginTop: 8,
  },
  warning: {
    borderColor: terminal.warning,
    borderWidth: 1,
    borderRadius: 4,
    padding: 12,
    marginTop: 12,
    marginBottom: 16,
  },
  warningText: {
    color: terminal.warning,
    fontFamily: terminal.mono,
    fontSize: 12,
    lineHeight: 18,
  },
  confirm: {
    backgroundColor: terminal.accent,
    borderRadius: 4,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmDisabled: {
    opacity: 0.4,
  },
  confirmText: {
    color: terminal.bg,
    fontFamily: terminal.mono,
    fontSize: 15,
    fontWeight: '700',
  },
});
