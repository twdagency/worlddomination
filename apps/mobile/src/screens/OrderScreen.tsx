import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import type { TransitOrder } from 'sim';
import { moveDistanceKm, previewMoveEtaMs, TUTORIAL_PARIS_TERRITORY_ID } from 'sim';
import { useGame } from '../game/GameContext';
import { formatIntelAge } from '../game/intelDisplay';
import { toggleExpandedRow } from '../game/expandableRowState';
import { ActionFeedbackBanner } from '../components/feedback/ActionFeedbackBanner';
import { ExpandableRow } from '../components/disclosure/ExpandableRow';
import { ScreenBackButton } from '../components/navigation/ScreenBackButton';
import { OrderInfluencePanel } from '../components/influence/OrderInfluencePanel';
import { OrderModeSegment } from '../components/influence/OrderModeSegment';
import { getPlayerVisibleTerritory,
  ownerIdForIntelDisplay,
  playerMovableUnits,
  playerOrderDestinations,
  resolvePlayerFactionId,
} from '../game/playerView';
import {
  classifyDestination,
  filterOrderDestinationsForStance,
  type DestinationStance,
} from '../game/orderDestinations';
import { TerritoryOwnerLabel } from '../components/TerritoryOwnerLabel';
import type { ActionStackParamList } from '../navigation/types';
import type { OrderScreenMode } from '../navigation/deepLinks';
import { navigateTo } from '../navigation/deepLinks';
import { selectTutorialInfluencePresetCityId } from '../game/tutorialBeatNavigation';
import { useNavigation } from '@react-navigation/native';
import type { InfluenceOrderActionKind } from '../game/influenceSelector';
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

function stancesForDestination(stance: DestinationStance) {
  if (stance === 'allied') {
    return STANCES.filter((entry) => entry.id === 'hold');
  }
  return STANCES;
}

type OrderRoute = RouteProp<ActionStackParamList, 'Order'>;

export function OrderScreen() {
  const route = useRoute<OrderRoute>();
  const navigation = useNavigation();
  const { world, confirmMove, issueInfluence, actionFeedback, isTutorialActive, currentBeat } =
    useGame();
  const playerId = resolvePlayerFactionId(world);
  const movableUnits = playerMovableUnits(world);
  const isMovementBeat = isTutorialActive && currentBeat === 'movement';
  const isInfluenceBeat = isTutorialActive && currentBeat === 'influence';

  const [mode, setMode] = useState<OrderScreenMode>('move');
  const [destinationId, setDestinationId] = useState<string>('');
  const [stance, setStance] = useState<TransitOrder['stanceOnArrival']>('assault');
  const [expandedSection, setExpandedSection] = useState<string | null>('confirm');
  const [presetLocked, setPresetLocked] = useState(false);
  const [presetDestinationId, setPresetDestinationId] = useState<string | null>(null);
  const [unitId, setUnitId] = useState('');

  useEffect(() => {
    if (route.params?.orderMode) {
      setMode(route.params.orderMode);
      return;
    }
    if (isInfluenceBeat) {
      setMode('influence');
    }
  }, [route.params?.orderMode, isInfluenceBeat]);

  useEffect(() => {
    const presetDestination = route.params?.presetDestinationId;
    const presetForce = route.params?.presetForceId;
    if (presetDestination) {
      setPresetDestinationId(presetDestination);
      setDestinationId(presetDestination);
      setPresetLocked(true);
      setMode('move');
    }
    if (presetForce) {
      setUnitId(presetForce);
    }
  }, [route.params?.presetDestinationId, route.params?.presetForceId]);

  useEffect(() => {
    if (isMovementBeat && movableUnits.length === 1) {
      setUnitId(movableUnits[0]!.id);
    }
  }, [isMovementBeat, movableUnits]);

  const unit = movableUnits.find((u) => u.id === unitId);
  const availableDestinations = useMemo(() => {
    const destinations = playerOrderDestinations(world, unit?.locationId);
    return filterOrderDestinationsForStance(world, playerId, stance, destinations);
  }, [world, unit?.locationId, playerId, stance]);

  useEffect(() => {
    if (presetLocked) return;
    if (!unitId || availableDestinations.length === 0) {
      setDestinationId('');
      return;
    }

    if (isMovementBeat) {
      const paris = availableDestinations.find(
        (destination) => destination.territoryId === TUTORIAL_PARIS_TERRITORY_ID,
      );
      if (paris) {
        setDestinationId(TUTORIAL_PARIS_TERRITORY_ID);
        return;
      }
    }

    setDestinationId((prev) =>
      availableDestinations.some((t) => t.territoryId === prev)
        ? prev
        : availableDestinations[0]!.territoryId,
    );
  }, [unitId, availableDestinations, isMovementBeat, presetLocked]);

  const selectedDestination = availableDestinations.find((t) => t.territoryId === destinationId);
  const selectedDestOwner = selectedDestination
    ? ownerIdForIntelDisplay(world, selectedDestination)
    : undefined;
  const selectedDestStance = classifyDestination(
    world,
    playerId,
    selectedDestination?.territoryId ?? '',
    selectedDestOwner,
  );
  const availableStances = stancesForDestination(selectedDestStance);

  useEffect(() => {
    if (!availableStances.some((entry) => entry.id === stance)) {
      setStance('hold');
    }
  }, [availableStances, stance]);

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
  const isHostile = selectedDestStance === 'hostile';

  const canConfirm = Boolean(
    unitId &&
      destinationId &&
      unit?.locationId &&
      unit.locationId !== destinationId &&
      preview &&
      distance !== null &&
      distance > 0,
  );

  const unitLabel = unit ? world.unitTypes[unit.typeId]?.name ?? unit.id : 'Force';
  const confirmSubtitle =
    fromName && toName && preview
      ? `${fromName} → ${toName} · ETA ${formatDuration(preview.travelMs)}`
      : 'Select force and destination';

  const destinationEmptyCopy =
    movableUnits.length === 0
      ? 'No forces available to deploy.'
      : !unitId || !unit
        ? 'Select a force above to issue an order.'
        : `${unitLabel} cannot move from ${fromName ?? 'current location'} — no reachable territories.`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenBackButton />
      <Text style={styles.heading}>Issue Orders</Text>

      <OrderModeSegment mode={mode} onChange={setMode} />

      {mode === 'build' ? (
        <TerminalCard testID="order-build-mode">
          <Text style={styles.optionTitle}>Build & infrastructure</Text>
          <Text style={styles.optionSub}>
            Unit production and infrastructure upgrades are managed per territory.
          </Text>
          <Pressable
            style={styles.buildLink}
            onPress={() =>
              navigateTo(navigation.getParent()!, { tab: 'actions', screen: 'territory' })
            }
            testID="order-open-territory"
          >
            <Text style={styles.buildLinkLabel}>Open Territory screen →</Text>
          </Pressable>
        </TerminalCard>
      ) : null}

      {mode === 'influence' && playerId ? (
        <OrderInfluencePanel
          world={world}
          playerId={playerId}
          actionFeedback={actionFeedback}
          presetCityId={
            route.params?.presetCityId ??
            (isInfluenceBeat ? selectTutorialInfluencePresetCityId(world) : undefined)
          }
          presetAction={
            (route.params?.presetInfluenceAction as InfluenceOrderActionKind | undefined) ??
            (isInfluenceBeat ? 'diplomatic-mission' : undefined)
          }
          onExecute={(cityId, kind) => void issueInfluence(cityId, kind)}
          onOpenTerritory={(cityId) =>
            navigateTo(navigation.getParent()!, { tab: 'actions', screen: 'territory', territoryId: cityId })
          }
        />
      ) : null}

      {mode === 'move' ? (
        <>
      <Text style={styles.headingSection}>Issue Move Order</Text>

      <ActionFeedbackBanner action="move" feedback={actionFeedback} />

      {presetLocked && presetDestinationId ? (
        <TerminalCard style={styles.presetBanner} testID="order-preset-banner">
          <Text style={styles.presetTitle}>
            Issuing order for{' '}
            {world.territories[presetDestinationId]?.name ?? presetDestinationId}
          </Text>
          <Pressable
            onPress={() => {
              setPresetLocked(false);
              setPresetDestinationId(null);
            }}
            accessibilityRole="button"
            accessibilityLabel="Change destination"
            testID="order-preset-change"
          >
            <Text style={styles.presetChange}>Change destination</Text>
          </Pressable>
        </TerminalCard>
      ) : null}

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
      {presetLocked ? null : availableDestinations.length === 0 ? (
        <TerminalCard>
          <Text style={styles.muted}>{destinationEmptyCopy}</Text>
        </TerminalCard>
      ) : (
        availableDestinations.map((destination) => {
          const ownerId = ownerIdForIntelDisplay(world, destination);
          const destinationStance = classifyDestination(
            world,
            playerId,
            destination.territoryId,
            ownerId,
          );
          const selected = destination.territoryId === destinationId;
          const isStale = destination.state === 'stale';
          const recommended =
            isMovementBeat && destination.territoryId === TUTORIAL_PARIS_TERRITORY_ID;

          return (
            <Pressable
              key={destination.territoryId}
              onPress={() => setDestinationId(destination.territoryId)}
            >
              <TerminalCard
                style={[
                  selected ? styles.selected : undefined,
                  isStale ? styles.staleCard : undefined,
                  recommended ? styles.recommendedCard : undefined,
                ]}
              >
                <TerritoryOwnerLabel
                  world={world}
                  territoryId={destination.territoryId}
                  ownerIdOverride={ownerId}
                  playerId={playerId}
                  variant="inline"
                  showStance
                  showLeader
                  stance={destinationStance}
                  recommended={recommended}
                  style={[styles.optionTitle, isStale && styles.staleTitle]}
                />
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
      {availableStances.map((s) => (
        <Pressable key={s.id} onPress={() => setStance(s.id)}>
          <TerminalCard style={stance === s.id ? styles.selected : undefined}>
            <Text style={styles.optionTitle}>{s.label}</Text>
            <Text style={styles.optionSub}>{s.hint}</Text>
          </TerminalCard>
        </Pressable>
      ))}

      <Text style={styles.section}>Confirm order</Text>
      <ExpandableRow
        rowId="confirm"
        title={`Deploy ${unitLabel}`}
        subtitle={confirmSubtitle}
        expanded={expandedSection === 'confirm'}
        highlighted={canConfirm}
        onToggle={(id) => setExpandedSection((prev) => toggleExpandedRow(prev, id))}
        secondary={
          preview && distance !== null && fromName && toName ? (
            <View style={styles.confirmBody}>
              <Text style={styles.route}>Route: {fromName} → {toName}</Text>
              <Text style={styles.route}>Distance: {formatDistance(distance)}</Text>
              <Text style={styles.route}>Speed: {formatSpeed(preview.speedKmh)}</Text>
              <Text style={styles.eta}>ETA: {formatDuration(preview.travelMs)}</Text>
              <Text style={styles.arrival}>Arrival: {formatDateTime(preview.etaMs)}</Text>
              <Text style={styles.noCost}>No resource cost for movement.</Text>
              {selectedDestination?.state === 'stale' && selectedDestination.lastObservedAt !== undefined && (
                <Text style={styles.staleWarning}>
                  Acting on stale intelligence ({formatIntelAge(world.nowMs, selectedDestination.lastObservedAt)}).
                </Text>
              )}
              {isHostile && stance === 'assault' && (
                <Text style={styles.combatHint}>Assault will engage hostile garrison on arrival.</Text>
              )}
              <View style={styles.warning}>
                <Text style={styles.warningText}>
                  Forces cannot be recalled instantly once deployed. Outpowered assaults take heavy casualties.
                </Text>
              </View>
              <Pressable
                style={[styles.confirm, !canConfirm && styles.confirmDisabled]}
                disabled={!canConfirm}
                onPress={() => void confirmMove(unitId, destinationId, stance)}
              >
                <Text style={styles.confirmText}>Confirm Departure</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={styles.muted}>Choose a valid force and destination to preview the order.</Text>
          )
        }
      />
        </>
      ) : null}
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
  headingSection: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  buildLink: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  buildLinkLabel: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 13,
    fontWeight: '700',
  },
  presetBanner: {
    borderColor: terminal.tutorial,
    marginBottom: 12,
    gap: 8,
  },
  presetTitle: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 14,
    fontWeight: '700',
  },
  presetChange: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 13,
    fontWeight: '700',
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
  recommendedCard: {
    borderColor: terminal.tutorial,
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
  confirmBody: {
    gap: 4,
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
  noCost: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
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
    marginBottom: 8,
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
    marginTop: 4,
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
