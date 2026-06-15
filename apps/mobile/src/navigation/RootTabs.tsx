import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { useGame } from '../game/GameContext';
import { FactionsScreen } from '../screens/FactionsScreen';
import { DispatchesScreen } from '../screens/DispatchesScreen';
import { ForcesScreen } from '../screens/ForcesScreen';
import { OrderScreen } from '../screens/OrderScreen';
import { TerritoryScreen } from '../screens/TerritoryScreen';
import { WorldScreen } from '../screens/WorldScreen';
import { terminal } from '../theme/terminal';

const Tab = createBottomTabNavigator();

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

export function RootTabs() {
  const { ready } = useGame();

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
      <Tab.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: terminal.card },
          headerTintColor: terminal.accent,
          headerTitleStyle: { fontFamily: terminal.mono, fontSize: 16 },
          tabBarStyle: { backgroundColor: terminal.card, borderTopColor: terminal.border },
          tabBarActiveTintColor: terminal.accent,
          tabBarInactiveTintColor: terminal.muted,
          tabBarLabelStyle: { fontFamily: terminal.mono, fontSize: 11 },
          tabBarIcon: () => null,
          tabBarIconStyle: { display: 'none', width: 0, height: 0 },
        }}
      >
        <Tab.Screen name="Dispatches" component={DispatchesScreen} />
        <Tab.Screen name="Factions" component={FactionsScreen} />
        <Tab.Screen name="World" component={WorldScreen} />
        <Tab.Screen name="Territory" component={TerritoryScreen} />
        <Tab.Screen name="Forces" component={ForcesScreen} />
        <Tab.Screen name="Order" component={OrderScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
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
