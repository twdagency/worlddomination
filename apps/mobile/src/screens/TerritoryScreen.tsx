import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import {
  canBuild,
  extractionPerHour,
  formatBuildBlockedMessage,
  maxBuildableTier,
  territoryIncomePerHour,
} from 'sim';
import type { ResourceId, UnitType } from 'sim';
import { UNIT_TYPES } from 'shared';
import { useGame } from '../game/GameContext';
import { playerOwnedTerritories, PLAYER_FACTION_ID } from '../game/playerView';
import type { ActionStackParamList } from '../navigation/types';
import { ActionFeedbackBanner } from '../components/feedback/ActionFeedbackBanner';
import { DevTimeSkip } from '../components/DevTimeSkip';
import { TerminalCard } from '../components/TerminalCard';
import { terminal } from '../theme/terminal';
import {
  formatDuration,
  formatFunding,
  formatRate,
  formatResource,
} from '../utils/format';

const PLAYER_FACTION = PLAYER_FACTION_ID;
const BUILDABLE_UNITS = UNIT_TYPES.filter((u) => u.domain === 'land' || u.domain === 'sea');

function resourceLabel(id: ResourceId): string {
  const labels: Record<ResourceId, string> = {
    fuel: 'Fuel',
    steel: 'Steel',
    rareMetals: 'Rare metals',
    food: 'Food',
  };
  return labels[id];
}

type TerritoryRoute = RouteProp<ActionStackParamList, 'Territory'>;

export function TerritoryScreen() {
  const route = useRoute<TerritoryRoute>();
  const { world, issueBuild, issueUpgradeInfra, actionFeedback } = useGame();
  const faction = world.factions[PLAYER_FACTION];

  const playerTerritories = useMemo(
    () => playerOwnedTerritories(world),
    [world],
  );

  const [territoryId, setTerritoryId] = useState('');

  useEffect(() => {
    if (playerTerritories.length === 0) {
      setTerritoryId('');
      return;
    }
    const routeTerritoryId = route.params?.territoryId;
    if (routeTerritoryId && playerTerritories.some((t) => t.id === routeTerritoryId)) {
      setTerritoryId(routeTerritoryId);
      return;
    }
    setTerritoryId((prev) =>
      playerTerritories.some((t) => t.id === prev) ? prev : playerTerritories[0].id,
    );
  }, [playerTerritories, route.params?.territoryId]);

  const territory = playerTerritories.find((t) => t.id === territoryId);
  const maxTier = territory ? maxBuildableTier(territory.infraLevel) : 0;
  const facilityLabel = territory && territory.infraLevel < 3 ? 'Depot' : 'Arsenal';

  const buildChecks = useMemo(() => {
    if (!territory) return {};
    return Object.fromEntries(
      BUILDABLE_UNITS.map((u) => [
        u.id,
        canBuild(world, territoryId, u.id, 1, PLAYER_FACTION),
      ]),
    );
  }, [world, territory, territoryId]);

  if (playerTerritories.length === 0 || !territory || !faction) {
    return (
      <View style={styles.container}>
        <Text style={styles.muted}>No territories under your control.</Text>
      </View>
    );
  }

  const incomeHr = territoryIncomePerHour(world, territoryId);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Territory</Text>

      <ActionFeedbackBanner action={['build', 'upgradeInfra']} feedback={actionFeedback} />

      <Text style={styles.section}>Location</Text>
      {playerTerritories.map((t) => (
        <Pressable key={t.id} onPress={() => setTerritoryId(t.id)}>
          <TerminalCard style={t.id === territoryId ? styles.selected : undefined}>
            <Text style={styles.optionTitle}>{t.name}</Text>
            <Text style={styles.optionSub}>
              Infra {t.infraLevel} · {t.infraLevel < 3 ? 'Depot' : 'Arsenal'}
            </Text>
          </TerminalCard>
        </Pressable>
      ))}

      <TerminalCard>
        <Text style={styles.stat}>Income: {formatRate(incomeHr, '/hr')}</Text>
        <Text style={styles.stat}>
          Funding: {formatFunding(faction.funding)} · Manpower:{' '}
          {Math.floor(faction.manpower).toLocaleString()} /{' '}
          {faction.manpowerCap.toLocaleString()}
        </Text>
        <Text style={styles.stat}>
          Facility: {facilityLabel} (builds tier 1–{maxTier})
        </Text>
      </TerminalCard>

      <Text style={styles.section}>Resources (local stock)</Text>
      <TerminalCard>
        {(['fuel', 'steel', 'rareMetals', 'food'] as const).map((id) => (
          <Text key={id} style={styles.stat}>
            {resourceLabel(id)}: {formatResource(territory.resources[id] ?? 0)}
            {extractionPerHour(territory, id) > 0
              ? ` (+${formatRate(extractionPerHour(territory, id), '/hr')})`
              : ''}
          </Text>
        ))}
      </TerminalCard>

      <Text style={styles.section}>Build queue</Text>
      {(territory.buildQueue ?? []).length === 0 ? (
        <TerminalCard>
          <Text style={styles.muted}>No units in production.</Text>
        </TerminalCard>
      ) : (
        (territory.buildQueue ?? []).map((item, i) => {
          const unitType = world.unitTypes[item.unitTypeId];
          const completeAt = item.startMs + item.durationMs;
          const remaining = Math.max(0, completeAt - world.nowMs);
          return (
            <TerminalCard key={`${item.unitTypeId}-${item.startMs}-${i}`}>
              <Text style={styles.optionTitle}>
                {unitType?.name ?? item.unitTypeId} ×{item.count}
              </Text>
              <Text style={styles.optionSub}>
                {remaining > 0 ? `${formatDuration(remaining)} remaining` : 'Completing…'}
              </Text>
            </TerminalCard>
          );
        })
      )}

      <Text style={styles.section}>Infrastructure</Text>
      <Pressable onPress={() => void issueUpgradeInfra(territoryId)}>
        <TerminalCard>
          <Text style={styles.optionTitle}>Upgrade infrastructure</Text>
          <Text style={styles.optionSub}>
            Level {territory.infraLevel} → {territory.infraLevel + 1} · boosts income &
            extraction
          </Text>
        </TerminalCard>
      </Pressable>

      <Text style={styles.section}>Build units</Text>
      {BUILDABLE_UNITS.map((unitType) => (
        <BuildUnitRow
          key={unitType.id}
          unitType={unitType}
          check={buildChecks[unitType.id]}
          onBuild={() => void issueBuild(territoryId, unitType.id, 1)}
        />
      ))}

      {__DEV__ && <DevTimeSkip />}
    </ScrollView>
  );
}

function BuildUnitRow({
  unitType,
  check,
  onBuild,
}: {
  unitType: UnitType;
  check: ReturnType<typeof canBuild> | undefined;
  onBuild: () => void;
}) {
  const blocked = check && !check.ok;
  const blockerText =
    blocked && check
      ? formatBuildBlockedMessage(unitType, check.reason)
      : undefined;

  return (
    <Pressable onPress={onBuild}>
      <TerminalCard style={blocked ? styles.blocked : undefined}>
        <Text style={styles.optionTitle}>
          {unitType.name} (tier {unitType.tier})
        </Text>
        <Text style={styles.optionSub}>
          {formatFunding(unitType.fundingCost)} · {unitType.manpowerCost} MP ·{' '}
          {unitType.buildHours}h
        </Text>
        {blockerText && <Text style={styles.blocker}>{blockerText}</Text>}
      </TerminalCard>
    </Pressable>
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
    marginTop: 12,
  },
  selected: {
    borderColor: terminal.accent,
  },
  blocked: {
    borderColor: terminal.warning,
    opacity: 0.85,
  },
  optionTitle: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 14,
  },
  optionSub: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginTop: 2,
  },
  stat: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 13,
    marginBottom: 4,
  },
  blocker: {
    color: terminal.warning,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginTop: 6,
    lineHeight: 18,
  },
  muted: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 13,
  },
});
