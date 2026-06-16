import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { getDilemmaById } from 'sim';
import { useGame } from '../game/GameContext';
import { selectPendingDilemmaCards } from '../game/dilemmaSelector';
import {
  getDashboardCatchUpSummary,
  getDashboardEmpireSummary,
  getDashboardNavCards,
  getDashboardUrgentItems,
  type DashboardNavTarget,
  type DashboardScreenName,
} from '../game/playerView';
import {
  resolveDashboardNavigation,
  resolveDashboardTarget,
} from '../navigation/dashboardNavigation';
import type { RootTabParamList } from '../navigation/types';
import { CatchUpSummary } from '../components/dashboard/CatchUpSummary';
import { DilemmaModal } from '../components/dilemma/DilemmaModal';
import { EmpireSummary } from '../components/dashboard/EmpireSummary';
import { NavigationGrid } from '../components/dashboard/NavigationGrid';
import { UrgentQueue } from '../components/dashboard/UrgentQueue';
import { terminal } from '../theme/terminal';

export function DashboardScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { world, dispatches, awayMs, resolvePendingDilemma } = useGame();
  const [activeDilemmaId, setActiveDilemmaId] = useState<string | null>(null);

  const pendingDilemmas = useMemo(() => selectPendingDilemmaCards(world), [world]);
  const activeDilemma = activeDilemmaId ? getDilemmaById(activeDilemmaId) : undefined;

  const catchUp = useMemo(
    () => getDashboardCatchUpSummary(world, dispatches, awayMs),
    [world, dispatches, awayMs],
  );
  const urgentItems = useMemo(
    () => getDashboardUrgentItems(world, dispatches),
    [world, dispatches],
  );
  const empire = useMemo(() => getDashboardEmpireSummary(world), [world]);
  const navCards = useMemo(
    () => getDashboardNavCards(world, dispatches),
    [world, dispatches],
  );

  const navigateTo = (target: DashboardNavTarget | DashboardScreenName) => {
    const resolved =
      typeof target === 'string'
        ? resolveDashboardNavigation(target)
        : resolveDashboardTarget(target);

    if (resolved.tab === 'Actions') {
      navigation.navigate('Actions', resolved.stack);
      return;
    }

    navigation.navigate(resolved.tab);
  };

  if (!empire) {
    return (
      <View style={styles.container}>
        <Text style={styles.muted}>No player faction found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Dashboard</Text>

      {pendingDilemmas[0] ? (
        <>
          <View style={styles.decisionCard} testID="pending-decision-card">
            <Text style={styles.decisionEyebrow}>
              ⚠ {pendingDilemmas.length} Decision Pending
            </Text>
            <Text style={styles.decisionTitle}>{pendingDilemmas[0].title}</Text>
            <Pressable
              style={styles.decideButton}
              onPress={() => setActiveDilemmaId(pendingDilemmas[0].dilemmaId)}
              accessibilityRole="button"
              accessibilityLabel={`Decide: ${pendingDilemmas[0].title}`}
              testID="pending-decision-open"
            >
              <Text style={styles.decideLabel}>Decide →</Text>
            </Pressable>
          </View>
          <View style={styles.spacer} />
        </>
      ) : null}

      <CatchUpSummary summary={catchUp} onOpenDispatches={() => navigation.navigate('Dispatches')} />

      <View style={styles.spacer} />

      <UrgentQueue items={urgentItems} onNavigate={navigateTo} />

      <View style={styles.spacer} />

      <EmpireSummary summary={empire} />

      <View style={styles.spacer} />

      <NavigationGrid cards={navCards} onNavigate={navigateTo} />

      {activeDilemma ? (
        <DilemmaModal
          visible
          dilemma={activeDilemma}
          onClose={() => setActiveDilemmaId(null)}
          onResolve={async (optionId) => {
            await resolvePendingDilemma(activeDilemma.id, optionId);
            setActiveDilemmaId(null);
          }}
        />
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
  spacer: {
    height: 16,
  },
  decisionCard: {
    backgroundColor: terminal.card,
    borderColor: terminal.warning,
    borderLeftWidth: 3,
    borderWidth: 1,
    borderRadius: 8,
    gap: 8,
    padding: 14,
  },
  decisionEyebrow: {
    color: terminal.warning,
    fontFamily: terminal.mono,
    fontSize: 12,
    fontWeight: '700',
  },
  decisionTitle: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 15,
    fontWeight: '700',
  },
  decideButton: {
    alignSelf: 'flex-start',
    borderColor: terminal.accent,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  decideLabel: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 13,
    fontWeight: '700',
  },
  muted: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 13,
    padding: 16,
  },
});
