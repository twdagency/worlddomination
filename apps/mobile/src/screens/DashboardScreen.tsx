import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useGame } from '../game/GameContext';
import {
  getDashboardCatchUpSummary,
  getDashboardEmpireSummary,
  getDashboardNavCards,
  getDashboardUrgentItems,
  type DashboardNavTarget,
  type DashboardScreenName,
} from '../game/playerView';
import { CatchUpSummary } from '../components/dashboard/CatchUpSummary';
import { EmpireSummary } from '../components/dashboard/EmpireSummary';
import { NavigationGrid } from '../components/dashboard/NavigationGrid';
import { UrgentQueue } from '../components/dashboard/UrgentQueue';
import { terminal } from '../theme/terminal';

type RootTabParamList = {
  Dashboard: undefined;
  Dispatches: undefined;
  Diplomacy: undefined;
  Factions: undefined;
  World: undefined;
  Territory: undefined;
  Forces: undefined;
  Order: undefined;
};

export function DashboardScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<RootTabParamList>>();
  const { world, dispatches, awayMs } = useGame();

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
    if (typeof target === 'string') {
      navigation.navigate(target);
      return;
    }
    navigation.navigate(target.screen);
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

      <CatchUpSummary summary={catchUp} onOpenDispatches={() => navigation.navigate('Dispatches')} />

      <View style={styles.spacer} />

      <UrgentQueue items={urgentItems} onNavigate={navigateTo} />

      <View style={styles.spacer} />

      <EmpireSummary summary={empire} />

      <View style={styles.spacer} />

      <NavigationGrid cards={navCards} onNavigate={navigateTo} />
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
  muted: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 13,
    padding: 16,
  },
});
