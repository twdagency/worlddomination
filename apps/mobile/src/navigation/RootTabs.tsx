import React, { useCallback, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DefaultTheme, type NavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveTabBarBottomInset } from './tabBarMetrics';
import { Ionicons } from '@expo/vector-icons';
import { useGame } from '../game/GameContext';
import { PersistentHeader } from '../components/PersistentHeader';
import { TutorialBanner } from '../components/tutorial/TutorialBanner';
import { ActionStackNavigator } from './ActionStackNavigator';
import { HomeStackNavigator } from './HomeStackNavigator';
import { maybeCollapseTutorialBannerOnNavigation } from './TutorialNavigationBridge';
import { rootNavigationRef } from './navigationRef';
import { WorldScreen } from '../screens/WorldScreen';
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
  } = useGame();

  const tabBarStyle = useTabBarStyle();

  const onNavigationStateChange = useCallback(
    (state: NavigationState | undefined) => {
      maybeCollapseTutorialBannerOnNavigation(state, {
        isTutorialActive,
        currentBeat,
        collapseTutorialBanner,
      });
    },
    [isTutorialActive, currentBeat, collapseTutorialBanner],
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
        {bannerMode !== 'hidden' && currentBeatCopy ? (
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
          screenOptions={{
            headerShown: false,
            tabBarStyle,
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
                    : WorldScreen
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
