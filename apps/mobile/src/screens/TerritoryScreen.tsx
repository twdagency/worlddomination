import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import {
  canBuild,
  extractionPerHour,
  maxBuildableTier,
  territoryIncomePerHour,
} from 'sim';
import type { ResourceId, UnitType, WorldState } from 'sim';
import { UNIT_TYPES } from 'shared';
import { resolvePlayerFactionId } from 'shared';
import { useGame } from '../game/GameContext';
import { getFactionIdentity } from '../game/factionDisplay';
import { playerOwnedTerritories } from '../game/playerView';
import {
  collectActiveBuilds,
  sortTerritoriesForDisplay,
  territoryGlanceSubtitle,
  territoryHasFoodShortage,
} from '../game/territoryDisclosure';
import { toggleExpandedRow } from '../game/expandableRowState';
import {
  infraUpgradeCostPreview,
  unitBuildCostPreview,
} from '../game/costPreview';
import { buildWhyExplanation, infraWhyExplanation } from '../game/whyBlockText';
import type { ActionStackParamList } from '../navigation/types';
import { ActionFeedbackBanner } from '../components/feedback/ActionFeedbackBanner';
import { ScreenBackButton } from '../components/navigation/ScreenBackButton';
import { CostBlock } from '../components/disclosure/CostBlock';
import { ExpandableRow } from '../components/disclosure/ExpandableRow';
import { WhyBlock } from '../components/disclosure/WhyBlock';
import { DevTimeSkip } from '../components/DevTimeSkip';
import { showDevControls } from '../game/devFlag';
import { TerminalCard } from '../components/TerminalCard';
import { terminal } from '../theme/terminal';
import {
  formatDuration,
  formatFunding,
  formatRate,
  formatResource,
} from '../utils/format';

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
  const playerId = resolvePlayerFactionId(world);
  const faction = playerId ? world.factions[playerId] : undefined;

  const playerTerritories = useMemo(
    () => sortTerritoriesForDisplay(playerOwnedTerritories(world)),
    [world],
  );

  const activeBuilds = useMemo(
    () => collectActiveBuilds(world, playerTerritories),
    [world, playerTerritories],
  );

  const [territoryId, setTerritoryId] = useState('');
  const [expandedTerritoryId, setExpandedTerritoryId] = useState<string | null>(null);

  useEffect(() => {
    if (playerTerritories.length === 0) {
      setTerritoryId('');
      return;
    }
    const routeTerritoryId = route.params?.territoryId;
    if (routeTerritoryId && playerTerritories.some((t) => t.id === routeTerritoryId)) {
      setTerritoryId(routeTerritoryId);
      setExpandedTerritoryId(routeTerritoryId);
      return;
    }
    setTerritoryId((prev) =>
      playerTerritories.some((t) => t.id === prev) ? prev : playerTerritories[0].id,
    );
  }, [playerTerritories, route.params?.territoryId]);

  const territory = playerTerritories.find((t) => t.id === territoryId);

  const buildChecks = useMemo(() => {
    if (!territory) return {};
    return Object.fromEntries(
      BUILDABLE_UNITS.map((u) => [
        u.id,
        canBuild(world, territoryId, u.id, 1, playerId!),
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
  const maxTier = maxBuildableTier(territory.infraLevel);
  const facilityLabel = territory.infraLevel < 3 ? 'Depot' : 'Arsenal';
  const infraCost = infraUpgradeCostPreview(world, territoryId, playerId!);
  const playerIdentity = getFactionIdentity(world, playerId!);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <ScreenBackButton />
      <Text style={styles.heading}>Territory</Text>
      <Text style={styles.playerIdentity}>
        {playerIdentity.compactLine} · {playerIdentity.citiesLine}
      </Text>

      <ActionFeedbackBanner action={['build', 'upgradeInfra']} feedback={actionFeedback} />

      {activeBuilds.length > 0 ? (
        <>
          <Text style={styles.section}>Active build queue</Text>
          {activeBuilds.map((entry, index) => {
            const unitName = world.unitTypes[entry.unitTypeId]?.name ?? entry.unitTypeId;
            return (
              <TerminalCard key={`${entry.territoryId}-${entry.unitTypeId}-${index}`}>
                <Text style={styles.optionTitle}>
                  {entry.territoryName}: {unitName} ×{entry.count}
                </Text>
                <Text style={styles.optionSub}>
                  {entry.remainingMs > 0
                    ? `${formatDuration(entry.remainingMs)} remaining`
                    : 'Completing…'}
                </Text>
              </TerminalCard>
            );
          })}
        </>
      ) : null}

      <Text style={styles.section}>Locations</Text>
      {playerTerritories.map((t) => (
        <ExpandableRow
          key={t.id}
          rowId={t.id}
          title={t.name}
          subtitle={territoryGlanceSubtitle(t)}
          expanded={expandedTerritoryId === t.id}
          highlighted={
            territoryHasFoodShortage(t) || (t.buildQueue?.length ?? 0) > 0
          }
          onToggle={(id) => {
            setTerritoryId(id);
            setExpandedTerritoryId((prev) => toggleExpandedRow(prev, id));
          }}
          secondary={
            t.id === territoryId ? (
              <TerritoryDetail
                world={world}
                territoryId={t.id}
                playerId={playerId!}
                faction={faction}
                incomeHr={incomeHr}
                maxTier={maxTier}
                facilityLabel={facilityLabel}
                buildChecks={buildChecks}
                infraCost={infraCost}
                onUpgrade={() => void issueUpgradeInfra(t.id)}
                onBuild={(unitTypeId) => void issueBuild(t.id, unitTypeId, 1)}
              />
            ) : (
              <Text style={styles.muted}>Tap to manage this territory.</Text>
            )
          }
        />
      ))}

      {showDevControls && <DevTimeSkip />}
    </ScrollView>
  );
}

function TerritoryDetail({
  world,
  territoryId,
  playerId,
  faction,
  incomeHr,
  maxTier,
  facilityLabel,
  buildChecks,
  infraCost,
  onUpgrade,
  onBuild,
}: {
  world: WorldState;
  territoryId: string;
  playerId: string;
  faction: NonNullable<WorldState['factions'][string]>;
  incomeHr: number;
  maxTier: number;
  facilityLabel: string;
  buildChecks: Record<string, ReturnType<typeof canBuild> | undefined>;
  infraCost: ReturnType<typeof infraUpgradeCostPreview>;
  onUpgrade: () => void;
  onBuild: (unitTypeId: string) => void;
}) {
  const territory = world.territories[territoryId];
  if (!territory) return null;

  return (
    <>
      <Text style={styles.stat}>Income: {formatRate(incomeHr, '/hr')}</Text>
      <Text style={styles.stat}>
        Funding: {formatFunding(faction.funding)} · Manpower:{' '}
        {Math.floor(faction.manpower).toLocaleString()} /{' '}
        {faction.manpowerCap.toLocaleString()}
      </Text>
      <Text style={styles.stat}>
        Facility: {facilityLabel} (builds tier 1–{maxTier})
      </Text>

      <Text style={styles.subsection}>Resources (local stock)</Text>
      {(['fuel', 'steel', 'rareMetals', 'food'] as const).map((id) => (
        <Text key={id} style={styles.stat}>
          {resourceLabel(id)}: {formatResource(territory.resources[id] ?? 0)}
          {extractionPerHour(territory, id) > 0
            ? ` (+${formatRate(extractionPerHour(territory, id), '/hr')})`
            : ''}
        </Text>
      ))}

      {(territory.buildQueue ?? []).length > 0 ? (
        <>
          <Text style={styles.subsection}>Build queue (this territory)</Text>
          {(territory.buildQueue ?? []).map((item, i) => {
            const unitType = world.unitTypes[item.unitTypeId];
            const completeAt = item.startMs + item.durationMs;
            const remaining = Math.max(0, completeAt - world.nowMs);
            return (
              <Text key={`${item.unitTypeId}-${item.startMs}-${i}`} style={styles.stat}>
                {unitType?.name ?? item.unitTypeId} ×{item.count} —{' '}
                {remaining > 0 ? `${formatDuration(remaining)} left` : 'Completing…'}
              </Text>
            );
          })}
        </>
      ) : null}

      <Text style={styles.subsection}>Infrastructure</Text>
      <Pressable onPress={onUpgrade}>
        <View style={styles.actionBlock}>
          <Text style={styles.optionTitle}>Upgrade infrastructure</Text>
          <Text style={styles.optionSub}>
            Level {territory.infraLevel} → {territory.infraLevel + 1}
          </Text>
          <CostBlock preview={infraCost} title="Upgrade cost" />
          <WhyBlock explanation={infraWhyExplanation(infraCost.shortfallLabel)} />
        </View>
      </Pressable>

      <Text style={styles.subsection}>Build units</Text>
      {BUILDABLE_UNITS.map((unitType) => (
        <BuildUnitRow
          key={unitType.id}
          world={world}
          territoryId={territoryId}
          playerId={playerId}
          unitType={unitType}
          check={buildChecks[unitType.id]}
          onBuild={() => onBuild(unitType.id)}
        />
      ))}
    </>
  );
}

function BuildUnitRow({
  world,
  territoryId,
  playerId,
  unitType,
  check,
  onBuild,
}: {
  world: WorldState;
  territoryId: string;
  playerId: string;
  unitType: UnitType;
  check: ReturnType<typeof canBuild> | undefined;
  onBuild: () => void;
}) {
  const preview = unitBuildCostPreview(world, territoryId, unitType, playerId);
  const blocked = check && !check.ok;
  const whyText =
    blocked && check
      ? buildWhyExplanation(
          world,
          playerId,
          territoryId,
          unitType,
          check.reason,
        )
      : undefined;

  return (
    <Pressable onPress={onBuild}>
      <View style={[styles.actionBlock, blocked ? styles.blocked : undefined]}>
        <Text style={styles.optionTitle}>
          {unitType.name} (tier {unitType.tier})
        </Text>
        <Text style={styles.optionSub}>{unitType.buildHours}h build time</Text>
        <CostBlock preview={preview} />
        <WhyBlock explanation={whyText} />
      </View>
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
    marginBottom: 8,
  },
  playerIdentity: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginBottom: 16,
    lineHeight: 18,
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
  subsection: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 12,
    marginBottom: 6,
  },
  blocked: {
    borderColor: terminal.warning,
    opacity: 0.9,
  },
  actionBlock: {
    borderWidth: 1,
    borderColor: terminal.border,
    borderRadius: 4,
    padding: 10,
    marginBottom: 8,
    gap: 4,
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
  },
  stat: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 13,
    marginBottom: 4,
  },
  muted: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 13,
  },
});
