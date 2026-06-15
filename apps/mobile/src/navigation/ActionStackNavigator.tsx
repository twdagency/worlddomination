import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActionMenuScreen } from '../screens/ActionMenuScreen';
import { DiplomacyScreen } from '../screens/DiplomacyScreen';
import { ForcesScreen } from '../screens/ForcesScreen';
import { OrderScreen } from '../screens/OrderScreen';
import { TerritoryScreen } from '../screens/TerritoryScreen';
import { terminal } from '../theme/terminal';
import type { ActionStackParamList } from './types';

const Stack = createNativeStackNavigator<ActionStackParamList>();

const stackScreenOptions = {
  headerStyle: { backgroundColor: terminal.card },
  headerTintColor: terminal.accent,
  headerTitleStyle: { fontFamily: terminal.mono, fontSize: 15 },
  contentStyle: { backgroundColor: terminal.bg },
};

export function ActionStackNavigator() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="ActionMenu"
        component={ActionMenuScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="Order" component={OrderScreen} />
      <Stack.Screen name="Diplomacy" component={DiplomacyScreen} />
      <Stack.Screen name="Territory" component={TerritoryScreen} />
      <Stack.Screen name="Forces" component={ForcesScreen} />
    </Stack.Navigator>
  );
}
