import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { WorldState } from 'sim';
import {
  selectCityInfluence,
  selectInfluenceTargetCityIds,
  type AvailableInfluenceAction,
  type InfluenceOrderActionKind,
} from '../../game/influenceSelector';
import { formatCooldownDays } from '../../game/influenceDisplay';
import { ActionFeedbackBanner } from '../feedback/ActionFeedbackBanner';
import { TerminalCard } from '../TerminalCard';
import { terminal } from '../../theme/terminal';
import { formatFunding } from '../../utils/format';
import type { ActionFeedback } from '../../game/actionFeedback';

interface OrderInfluencePanelProps {
  world: WorldState;
  playerId: string;
  actionFeedback: ActionFeedback | null;
  presetCityId?: string;
  presetAction?: InfluenceOrderActionKind;
  onExecute: (cityId: string, kind: InfluenceOrderActionKind) => void;
  onOpenTerritory: (cityId: string) => void;
}

function InfluenceActionCard({
  action,
  selectedCityId,
  onExecute,
}: {
  action: AvailableInfluenceAction;
  selectedCityId: string;
  onExecute: (kind: InfluenceOrderActionKind) => void;
}) {
  const disabled = !action.unlocked;
  const costParts = [
  formatFunding(action.cost.gold),
    action.cost.manpower ? `${action.cost.manpower} MP` : null,
  ].filter(Boolean);

  return (
    <TerminalCard
      style={[styles.actionCard, disabled && styles.actionCardDisabled]}
      testID={`influence-action-${action.kind}`}
    >
      <Text style={[styles.actionTitle, disabled && styles.mutedText]}>{action.label}</Text>
      <Text style={[styles.actionMeta, disabled && styles.mutedText]}>
        Requires {action.thresholdRequired > 0 ? `${action.thresholdRequired}+ influence` : 'valid target'}
        {' · '}
        {costParts.join(' · ') || 'No cost'}
      </Text>
      <Text style={[styles.actionDescription, disabled && styles.mutedText]}>
        {action.description}
      </Text>
      {action.cooldownRemainingMs ? (
        <Text style={styles.cooldown}>{formatCooldownDays(action.cooldownRemainingMs)}</Text>
      ) : null}
      {disabled && action.rejectionReason ? (
        <Text style={styles.rejection} testID={`influence-action-rejection-${action.kind}`}>
          {action.rejectionReason}
        </Text>
      ) : null}
      {!disabled ? (
        <Pressable
          style={styles.executeButton}
          onPress={() => onExecute(action.kind)}
          accessibilityRole="button"
          testID={`influence-action-execute-${action.kind}`}
        >
          <Text style={styles.executeLabel}>Execute</Text>
        </Pressable>
      ) : null}
    </TerminalCard>
  );
}

export function OrderInfluencePanel({
  world,
  playerId,
  actionFeedback,
  presetCityId,
  presetAction,
  onExecute,
  onOpenTerritory,
}: OrderInfluencePanelProps) {
  const targetCityIds = useMemo(
    () => selectInfluenceTargetCityIds(world, playerId),
    [world, playerId],
  );
  const [cityId, setCityId] = useState('');

  useEffect(() => {
    if (presetCityId && targetCityIds.includes(presetCityId)) {
      setCityId(presetCityId);
      return;
    }
    setCityId((prev) => (targetCityIds.includes(prev) ? prev : (targetCityIds[0] ?? '')));
  }, [presetCityId, targetCityIds]);

  const cityView = cityId ? selectCityInfluence(world, cityId, playerId) : null;
  const accelerators = cityView?.availableActions.filter((action) =>
    ['diplomatic-mission', 'cultural-campaign', 'influence-subversion'].includes(action.kind),
  );
  const thresholds = cityView?.availableActions.filter(
    (action) => !['diplomatic-mission', 'cultural-campaign', 'influence-subversion'].includes(action.kind),
  );

  useEffect(() => {
    if (presetAction && cityId && cityView?.availableActions.some((a) => a.kind === presetAction && a.unlocked)) {
      // Preset is handled by parent navigation only — no auto-fire.
    }
  }, [presetAction, cityId, cityView]);

  if (targetCityIds.length === 0) {
    return (
      <TerminalCard testID="order-influence-empty">
        <Text style={styles.muted}>No foreign cities available for influence actions.</Text>
      </TerminalCard>
    );
  }

  return (
    <View testID="order-influence-panel">
      <ActionFeedbackBanner action="influence" feedback={actionFeedback} />

      <Text style={styles.section}>Target city</Text>
      {targetCityIds.map((id) => {
        const city = world.territories[id];
        const selected = id === cityId;
        return (
          <Pressable key={id} onPress={() => setCityId(id)}>
            <TerminalCard style={selected ? styles.selected : undefined}>
              <Text style={styles.optionTitle}>{city?.name ?? id}</Text>
              <Text style={styles.optionSub}>
                {selectCityInfluence(world, id, playerId)?.countryName ?? 'Unknown owner'}
              </Text>
            </TerminalCard>
          </Pressable>
        );
      })}

      {cityView ? (
        <Pressable onPress={() => onOpenTerritory(cityView.cityId)} testID="order-influence-territory-link">
          <Text style={styles.detailLink}>View influence detail for {cityView.cityName} →</Text>
        </Pressable>
      ) : null}

      <Text style={styles.section}>Accelerators</Text>
      {accelerators?.map((action) => (
        <InfluenceActionCard
          key={action.kind}
          action={action}
          selectedCityId={cityId}
          onExecute={(kind) => onExecute(cityId, kind)}
        />
      ))}

      <Text style={styles.section}>Threshold actions</Text>
      {thresholds?.map((action) => (
        <InfluenceActionCard
          key={action.kind}
          action={action}
          selectedCityId={cityId}
          onExecute={(kind) => onExecute(cityId, kind)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 12,
  },
  selected: {
    borderColor: terminal.accent,
  },
  optionTitle: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 14,
    fontWeight: '700',
  },
  optionSub: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginTop: 2,
  },
  actionCard: {
    marginBottom: 8,
    gap: 4,
  },
  actionCardDisabled: {
    opacity: 0.6,
  },
  actionTitle: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 14,
    fontWeight: '700',
  },
  actionMeta: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
  },
  actionDescription: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 12,
    lineHeight: 17,
  },
  cooldown: {
    color: terminal.warning,
    fontFamily: terminal.mono,
    fontSize: 12,
  },
  rejection: {
    color: terminal.stale,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginTop: 4,
  },
  executeButton: {
    marginTop: 8,
    backgroundColor: terminal.accent,
    borderRadius: 4,
    paddingVertical: 10,
    alignItems: 'center',
  },
  executeLabel: {
    color: terminal.bg,
    fontFamily: terminal.mono,
    fontSize: 13,
    fontWeight: '700',
  },
  detailLink: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  muted: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 13,
  },
  mutedText: {
    color: terminal.stale,
  },
});
