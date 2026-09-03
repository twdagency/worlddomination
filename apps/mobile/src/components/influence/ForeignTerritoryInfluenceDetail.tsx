import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { WorldState } from 'sim';
import {
  formatThresholdProximity,
  selectCityInfluence,
  type CityInfluenceView,
} from '../../game/influenceSelector';
import {
  formatFoggedActorInfluence,
  formatInfluenceValue,
  formatNetRatePerDay,
  formatSourceContribution,
} from '../../game/influenceDisplay';
import {
  TERRITORY_INFLUENCE_NET_TOOLTIP,
  TERRITORY_INFLUENCE_SOURCES_TOOLTIP,
  TERRITORY_INFLUENCE_THRESHOLD_TOOLTIP,
} from '../../game/influenceTooltips';
import { deepLinkForInfluenceAction } from '../../navigation/deepLinks';
import { useDeepLinkNavigation } from '../../navigation/useDeepLinkNavigation';
import { TooltipInfoIcon } from '../tooltip/TooltipInfoIcon';
import { TerminalCard } from '../TerminalCard';
import { terminal } from '../../theme/terminal';

interface ForeignTerritoryInfluenceDetailProps {
  world: WorldState;
  cityId: string;
  playerId: string;
}

function ActionShortcut({
  view,
  kind,
  label,
}: {
  view: CityInfluenceView;
  kind: CityInfluenceView['availableActions'][number]['kind'];
  label: string;
}) {
  const navigateDeep = useDeepLinkNavigation();
  const action = view.availableActions.find((entry) => entry.kind === kind);
  if (!action) return null;

  return (
    <Pressable
      onPress={() => navigateDeep(deepLinkForInfluenceAction(view.cityId, kind))}
      accessibilityRole="button"
      accessibilityLabel={`${label} for ${view.cityName}`}
      testID={`territory-influence-action-${kind}`}
    >
      <Text style={styles.shortcut}>{label} →</Text>
    </Pressable>
  );
}

export function ForeignTerritoryInfluenceDetail({
  world,
  cityId,
  playerId,
}: ForeignTerritoryInfluenceDetailProps) {
  const view = selectCityInfluence(world, cityId, playerId);
  if (!view) {
    return <Text style={styles.muted}>Territory not found.</Text>;
  }

  const proximity = formatThresholdProximity(view);

  return (
    <View testID="territory-influence-detail">
      <Text style={styles.section}>Influence</Text>
      <TerminalCard>
        <Text style={styles.valueLine} testID="territory-influence-value">
          {formatInfluenceValue(view.playerInfluence)} (you)
        </Text>
        {view.hasActiveMission ? (
          <Text style={styles.hint}>Active diplomatic mission doubling accrual.</Text>
        ) : null}
        {view.hasActiveTribute ? (
          <Text style={styles.hint}>Tribute extraction active.</Text>
        ) : null}

        <View style={styles.subsectionRow}>
          <Text style={styles.subsectionInline}>Sources</Text>
          <TooltipInfoIcon
            tooltip={TERRITORY_INFLUENCE_SOURCES_TOOLTIP}
            testID="territory-influence-sources-info"
          />
        </View>
        {view.influenceSources.length === 0 ? (
          <Text style={styles.stat}>No passive sources — decay may apply.</Text>
        ) : (
          view.influenceSources.map((source) => (
            <Text key={source.kind} style={styles.stat}>
              {formatSourceContribution(source.kind, source.contribution)}
            </Text>
          ))
        )}
        <View style={styles.statRow}>
          <Text style={styles.stat}>Net: {formatNetRatePerDay(view.decayPerDay)}</Text>
          <TooltipInfoIcon
            tooltip={TERRITORY_INFLUENCE_NET_TOOLTIP}
            testID="territory-influence-net-info"
          />
        </View>

        {view.competingActors.length > 0 ? (
          <>
            <Text style={styles.subsection}>Other actors</Text>
            {view.competingActors.map((actor) => (
              <Text key={actor.actorId} style={styles.stat} testID={`territory-competitor-${actor.actorId}`}>
                {formatFoggedActorInfluence(actor.actorName, actor.visibleMagnitude)}
              </Text>
            ))}
          </>
        ) : null}

        <View style={styles.subsectionRow}>
          <Text style={styles.subsectionInline}>Threshold proximity</Text>
          <TooltipInfoIcon
            tooltip={TERRITORY_INFLUENCE_THRESHOLD_TOOLTIP}
            testID="territory-influence-threshold-info"
          />
        </View>
        {proximity.map((entry) => (
          <Text key={entry.label} style={styles.stat}>
            {entry.detail}
          </Text>
        ))}

        <View style={styles.shortcuts}>
          <ActionShortcut view={view} kind="diplomatic-mission" label="Diplomatic mission" />
          <ActionShortcut view={view} kind="cultural-campaign" label="Cultural campaign" />
          <ActionShortcut view={view} kind="influence-subversion" label="Subversion" />
          <ActionShortcut view={view} kind="gather-intelligence" label="Intelligence" />
          <ActionShortcut view={view} kind="diplomatic-pressure" label="Diplomatic pressure" />
          <ActionShortcut view={view} kind="tribute-extraction" label="Tribute extraction" />
          {view.hasActiveTribute ? (
            <ActionShortcut view={view} kind="tribute-cancel" label="Cancel tribute" />
          ) : null}
          <ActionShortcut view={view} kind="coup-attempt" label="Coup attempt" />
          <ActionShortcut view={view} kind="defection-claim" label="Defection" />
        </View>
      </TerminalCard>
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
  subsection: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 6,
  },
  subsectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 6,
  },
  subsectionInline: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  valueLine: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 15,
    fontWeight: '700',
  },
  hint: {
    color: terminal.warning,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginTop: 6,
  },
  stat: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 13,
    marginBottom: 4,
    lineHeight: 18,
  },
  shortcuts: {
    marginTop: 12,
    gap: 6,
  },
  shortcut: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  muted: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 13,
  },
});
