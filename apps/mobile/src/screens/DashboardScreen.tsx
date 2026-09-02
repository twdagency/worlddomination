import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useGame } from '../game/GameContext';
import { selectPlayerCountry } from '../game/countrySelector';
import { selectDefeatedCountries } from '../game/defeatedCountrySelector';
import { selectPendingDilemmaCards } from '../game/dilemmaSelector';
import {
  getDashboardActiveForcesSummary,
  getDashboardCatchUpSummary,
  getDashboardDispatchesDigest,
  getDashboardUnreadDispatchCount,
} from '../game/playerView';
import { navigateTo } from '../navigation/deepLinks';
import type { HomeStackParamList } from '../navigation/types';
import { selectPlayerInfluenceSummary } from '../game/influenceSelector';
import { CatchUpSummary } from '../components/dashboard/CatchUpSummary';
import { ActiveForcesCard } from '../components/dashboard/ActiveForcesCard';
import { CountryStatusCard } from '../components/dashboard/CountryStatusCard';
import { InfluenceCard } from '../components/dashboard/InfluenceCard';
import { PlayerFallenOverlay } from '../components/dashboard/PlayerFallenOverlay';
import { PlayerVictoryOverlay } from '../components/dashboard/PlayerVictoryOverlay';
import { DispatchesCard } from '../components/dashboard/DispatchesCard';
import { QuickActionsCard, type QuickActionId } from '../components/dashboard/QuickActionsCard';
import { ScrollFadeFooter } from '../components/ScrollFadeFooter';
import { terminal } from '../theme/terminal';

type DashboardNavigation = NativeStackNavigationProp<HomeStackParamList, 'DashboardHome'>;

export function DashboardScreen() {
  const navigation = useNavigation<DashboardNavigation>();
  const { world, dispatches, dispatchReadState, awayMs, markDispatchesViewed, openDilemmaModal } =
    useGame();
  const [fallenAcknowledged, setFallenAcknowledged] = useState(false);
  const [victoryAcknowledged, setVictoryAcknowledged] = useState(false);

  useFocusEffect(
    useCallback(() => {
      markDispatchesViewed();
    }, [markDispatchesViewed]),
  );

  const pendingDilemmas = useMemo(() => selectPendingDilemmaCards(world), [world]);
  const playerCountry = useMemo(() => selectPlayerCountry(world), [world]);
  const defeatedCountries = useMemo(() => selectDefeatedCountries(world), [world]);
  const dispatchDigest = useMemo(
    () => getDashboardDispatchesDigest(world, dispatches),
    [world, dispatches],
  );
  const unreadDispatchCount = useMemo(
    () => getDashboardUnreadDispatchCount(world, dispatches, dispatchReadState),
    [world, dispatches, dispatchReadState],
  );
  const activeForces = useMemo(() => getDashboardActiveForcesSummary(world), [world]);
  const influenceSummary = useMemo(() => selectPlayerInfluenceSummary(world), [world]);
  const catchUpSummary = useMemo(
    () => getDashboardCatchUpSummary(world, dispatches, awayMs ?? 0),
    [world, dispatches, awayMs],
  );

  const openDispatches = (dispatchId?: string) => {
    navigation.navigate('Dispatches', dispatchId ? { dispatchId } : undefined);
  };

  const handleQuickAction = (action: QuickActionId) => {
    if (action === 'territory') {
      const capitalId = playerCountry?.capitalTerritoryId;
      navigateTo(navigation.getParent()!, {
        tab: 'actions',
        screen: 'territory',
        territoryId: capitalId,
      });
      return;
    }

    navigateTo(navigation.getParent()!, {
      tab: 'actions',
      screen: action,
    });
  };

  if (!playerCountry) {
    return (
      <View style={styles.container}>
        <Text style={styles.muted}>No player country found.</Text>
      </View>
    );
  }

  const openDefeatedCountries = () => {
    navigation.navigate('DefeatedCountries');
  };

  const showVictoryOverlay = Boolean(
    world?.victorId === playerCountry?.id && !victoryAcknowledged,
  );
  const showFallenOverlay = Boolean(
    playerCountry?.defeated && !fallenAcknowledged && !showVictoryOverlay,
  );

  return (
    <View style={styles.scrollWrap}>
      <PlayerVictoryOverlay
        visible={showVictoryOverlay}
        countryName={playerCountry?.name ?? 'Your country'}
        onContinue={() => setVictoryAcknowledged(true)}
      />
      <PlayerFallenOverlay
        visible={showFallenOverlay}
        countryName={playerCountry?.name ?? 'Your country'}
        onContinue={() => setFallenAcknowledged(true)}
      />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator
        persistentScrollbar
      >
        <Text style={styles.heading}>Dashboard</Text>

        {catchUpSummary.mode === 'away' ? (
          <>
            <CatchUpSummary summary={catchUpSummary} onOpenDispatches={() => openDispatches()} />
            <View style={styles.spacer} />
          </>
        ) : null}

        {pendingDilemmas[0] ? (
          <>
            <View style={styles.decisionCard} testID="pending-decision-card">
              <Text style={styles.decisionEyebrow}>
                ⚠ {pendingDilemmas.length} Decision Pending
              </Text>
              <Text style={styles.decisionTitle}>{pendingDilemmas[0].title}</Text>
              <Pressable
                style={styles.decideButton}
                onPress={() => openDilemmaModal(pendingDilemmas[0].dilemmaId)}
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

        <DispatchesCard
          items={dispatchDigest}
          unreadCount={unreadDispatchCount}
          onOpenDispatch={(dispatchId) => openDispatches(dispatchId)}
          onViewAll={() => openDispatches()}
        />

        <View style={styles.spacer} />

        <CountryStatusCard
          country={playerCountry}
          defeatedCount={defeatedCountries.length}
          onViewDefeated={defeatedCountries.length > 0 ? openDefeatedCountries : undefined}
        />

        <View style={styles.spacer} />

        {influenceSummary ? (
          <InfluenceCard
            summary={influenceSummary}
            onOpenCity={(cityId) =>
              navigateTo(navigation.getParent()!, {
                tab: 'actions',
                screen: 'territory',
                territoryId: cityId,
              })
            }
            onOpenInfluence={() =>
              navigateTo(navigation.getParent()!, { tab: 'actions', screen: 'order', orderMode: 'influence' })
            }
          />
        ) : null}

        <View style={styles.spacer} />

        <ActiveForcesCard summary={activeForces} />

        <View style={styles.spacer} />

        <QuickActionsCard
          onAction={handleQuickAction}
          disabled={playerCountry.defeated}
        />
      </ScrollView>
      <ScrollFadeFooter testID="dashboard-scroll-fade" />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollWrap: {
    flex: 1,
    position: 'relative',
  },
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
  decideLabel: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 13,
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
  muted: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 13,
    padding: 16,
  },
});
