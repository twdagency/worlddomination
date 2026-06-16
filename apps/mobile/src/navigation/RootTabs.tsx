import React from 'react';
import { ActivityIndicator, Platform, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useGame } from '../game/GameContext';
import { PersistentHeader } from '../components/PersistentHeader';
import { TutorialBanner } from '../components/tutorial/TutorialBanner';
import { ActionStackNavigator } from './ActionStackNavigator';
import { DispatchesScreen } from '../screens/DispatchesScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
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

export function RootTabs() {
  const { ready, shouldShowBanner, currentBeatCopy, dismissBanner } = useGame();

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={terminal.accent} />
        <Text style={styles.loadingText}>Loading campaign…</Text>
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      <View style={styles.appShell}>
        <PersistentHeader />
        {shouldShowBanner && currentBeatCopy ? (
          <TutorialBanner copy={currentBeatCopy} onDismiss={dismissBanner} />
        ) : null}
        <Tab.Navigator
          initialRouteName="Dashboard"
          screenOptions={{
            headerShown: false,
            tabBarStyle: styles.tabBar,
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
                tab.screen === 'Actions' ? ActionStackNavigator : screenForTab(tab.screen)
              }
              options={{
                title: tab.label,
                tabBarIcon: tabBarIcon(tab.iconName, tab.activeIconName),
                tabBarLabel: tab.label,
              }}
            />
          ))}
        </Tab.Navigator>
      </View>
    </NavigationContainer>
  );
}

function screenForTab(tab: Exclude<keyof RootTabParamList, 'Actions'>) {
  switch (tab) {
    case 'Dashboard':
      return DashboardScreen;
    case 'Dispatches':
      return DispatchesScreen;
    case 'World':
      return WorldScreen;
    default:
      return DashboardScreen;
  }
}

const styles = StyleSheet.create({
  appShell: {
    flex: 1,
    backgroundColor: terminal.bg,
  },
  tabBar: {
    backgroundColor: terminal.card,
    borderTopColor: terminal.border,
    height: Platform.OS === 'ios' ? 84 : 64,
    paddingBottom: Platform.OS === 'ios' ? 24 : 8,
    paddingTop: 6,
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
