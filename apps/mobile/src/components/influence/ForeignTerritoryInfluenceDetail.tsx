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
import { deepLinkForInfluenceAction } from '../../navigation/deepLinks';
import { useDeepLinkNavigation } from '../../navigation/useDeepLinkNavigation';
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

        <Text style={styles.subsection}>Sources</Text>
        {view.influenceSources.length === 0 ? (
          <Text style={styles.stat}>No passive sources — decay may apply.</Text>
        ) : (
          view.influenceSources.map((source) => (
            <Text key={source.kind} style={styles.stat}>
              {formatSourceContribution(source.kind, source.contribution)}
            </Text>
          ))
        )}
        <Text style={styles.stat}>Net: {formatNetRatePerDay(view.decayPerDay)}</Text>

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

        <Text style={styles.subsection}>Threshold proximity</Text>
        {proximity.map((entry) => (
          <Text key={entry.label} style={styles.stat}>
            {entry.detail}
          </Text>
        ))}

        <View style={styles.shortcuts}>
          <ActionShortcut view={view} kind="diplomatic-mission" label="Diplomatic mission" />
          <ActionShortcut view={view} kind="cultural-campaign" label="Cultural campaign" />
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
