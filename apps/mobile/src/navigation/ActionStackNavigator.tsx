import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActionMenuScreen } from '../screens/ActionMenuScreen';
import { DiplomacyScreen } from '../screens/DiplomacyScreen';
import { ForcesScreen } from '../screens/ForcesScreen';
import { OrderScreen } from '../screens/OrderScreen';
import { TerritoryScreen } from '../screens/TerritoryScreen';
import { ACTION_STACK_SCREEN_OPTIONS } from './actionStackConfig';
import type { ActionStackParamList } from './types';

const Stack = createNativeStackNavigator<ActionStackParamList>();

export function ActionStackNavigator() {
  return (
    <Stack.Navigator screenOptions={ACTION_STACK_SCREEN_OPTIONS}>
      <Stack.Screen name="ActionMenu" component={ActionMenuScreen} />
      <Stack.Screen name="Order" component={OrderScreen} />
      <Stack.Screen name="Diplomacy" component={DiplomacyScreen} />
      <Stack.Screen name="Territory" component={TerritoryScreen} />
      <Stack.Screen name="Forces" component={ForcesScreen} />
    </Stack.Navigator>
  );
}
