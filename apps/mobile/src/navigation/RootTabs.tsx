import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DefaultTheme, type NavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveTabBarBottomInset } from './tabBarMetrics';
import { Ionicons } from '@expo/vector-icons';
import { useGame } from '../game/GameContext';
import { useTooltip } from '../components/tooltip/TooltipContext';
import { PersistentHeader } from '../components/PersistentHeader';
import { TutorialBanner } from '../components/tutorial/TutorialBanner';
import { DilemmaModalOverlay } from '../components/dilemma/DilemmaModalOverlay';
import { ActionStackNavigator } from './ActionStackNavigator';
import { HomeStackNavigator } from './HomeStackNavigator';
import { WorldStackNavigator } from './WorldStackNavigator';
import { maybeCollapseTutorialBannerOnNavigation } from './TutorialNavigationBridge';
import { rootNavigationRef } from './navigationRef';
import { PRIMARY_TAB_ICONS } from './tabConfig';
import { terminal } from '../theme/terminal';
import type { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: terminal.bg,
    card: terminal.card,
    text: terminal.text,
    border: terminal.border,
    primary: terminal.accent,
  },
};

function tabBarIcon(iconName: string, activeIconName: string) {
  return ({ focused, color, size }: { focused: boolean; color: string; size: number }) => (
    <Ionicons
      name={(focused ? activeIconName : iconName) as keyof typeof Ionicons.glyphMap}
      size={size}
      color={color}
    />
  );
}

function useTabBarStyle() {
  const insets = useSafeAreaInsets();
  return useMemo(() => {
    const bottomInset = resolveTabBarBottomInset(insets.bottom);
    return {
      backgroundColor: terminal.card,
      borderTopColor: terminal.border,
      paddingTop: 6,
      paddingBottom: bottomInset,
    };
  }, [insets.bottom]);
}

export function RootTabs() {
  const {
    ready,
    bannerMode,
    currentBeatCopy,
    currentBeat,
    dismissBanner,
    expandTutorialBanner,
    collapseTutorialBanner,
    isHandoffReady,
    isTutorialActive,
    graduate,
    dilemmaModalState,
    dismissDilemmaModal,
    resolvePendingDilemma,
  } = useGame();
  const { dismissActiveTooltip } = useTooltip();

  const tabBarStyle = useTabBarStyle();
  const crisisModalOpen =
    dilemmaModalState.visible && dilemmaModalState.urgency === 'crisis';

  useEffect(() => {
    if (crisisModalOpen) {
      dismissActiveTooltip();
    }
  }, [crisisModalOpen, dismissActiveTooltip]);
  const skipNavDismissRef = useRef(true);

  const onNavigationStateChange = useCallback(
    (state: NavigationState | undefined) => {
      if (skipNavDismissRef.current) {
        skipNavDismissRef.current = false;
      } else if (
        dilemmaModalState.visible &&
        dilemmaModalState.canDismiss &&
        !dilemmaModalState.blocksNavigation
      ) {
        dismissDilemmaModal();
      }
      maybeCollapseTutorialBannerOnNavigation(state, {
        isTutorialActive,
        currentBeat,
        collapseTutorialBanner,
      });
    },
    [
      isTutorialActive,
      currentBeat,
      collapseTutorialBanner,
      dilemmaModalState.visible,
      dilemmaModalState.canDismiss,
      dilemmaModalState.blocksNavigation,
      dismissDilemmaModal,
    ],
  );

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={terminal.accent} />
        <Text style={styles.loadingText}>Loading campaign…</Text>
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={rootNavigationRef}
      theme={navTheme}
      onReady={() => onNavigationStateChange(rootNavigationRef.getRootState())}
      onStateChange={onNavigationStateChange}
    >
      <View style={styles.appShell}>
        <PersistentHeader />
        {bannerMode !== 'hidden' && currentBeatCopy && !crisisModalOpen ? (
          <TutorialBanner
            copy={currentBeatCopy}
            mode={bannerMode}
            onDismiss={dismissBanner}
            onExpand={expandTutorialBanner}
            onCollapse={collapseTutorialBanner}
            isHandoffReady={isHandoffReady}
            onGraduate={graduate}
          />
        ) : null}
        <Tab.Navigator
          initialRouteName="Dashboard"
          screenListeners={{
            tabPress: (event) => {
              if (dilemmaModalState.blocksNavigation) {
                event.preventDefault();
              }
            },
          }}
          screenOptions={{
            headerShown: false,
            tabBarStyle: [
              tabBarStyle,
              dilemmaModalState.blocksNavigation ? styles.tabBlocked : null,
            ],
            tabBarActiveTintColor: terminal.accent,
            tabBarInactiveTintColor: terminal.muted,
            tabBarLabelStyle: styles.tabLabel,
            tabBarShowLabel: true,
          }}
        >
          {PRIMARY_TAB_ICONS.map((tab) => (
            <Tab.Screen
              key={tab.screen}
              name={tab.screen}
              component={
                tab.screen === 'Actions'
                  ? ActionStackNavigator
                  : tab.screen === 'Dashboard'
                    ? HomeStackNavigator
                    : tab.screen === 'World'
                      ? WorldStackNavigator
                      : WorldStackNavigator
              }
              options={{
                title: tab.label,
                tabBarIcon: tabBarIcon(tab.iconName, tab.activeIconName),
                tabBarLabel: tab.label,
                tabBarButtonTestID: tab.testID,
                tabBarAccessibilityLabel: tab.accessibilityLabel,
              }}
            />
          ))}
        </Tab.Navigator>
        <DilemmaModalOverlay
          visible={dilemmaModalState.visible}
          dilemma={dilemmaModalState.dilemmaSnapshot}
          urgency={dilemmaModalState.urgency}
          canDismiss={dilemmaModalState.canDismiss}
          onDismiss={dismissDilemmaModal}
          onResolve={(optionId) => {
            if (!dilemmaModalState.dilemmaId) return;
            void resolvePendingDilemma(dilemmaModalState.dilemmaId, optionId);
          }}
        />
      </View>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: terminal.bg,
  },
  tabLabel: {
    fontFamily: terminal.mono,
    fontSize: 10,
  },
  tabBlocked: {
    opacity: 0.35,
  },
  loading: {
    flex: 1,
    backgroundColor: terminal.bg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: terminal.muted,
    fontFamily: terminal.mono,
  },
});
