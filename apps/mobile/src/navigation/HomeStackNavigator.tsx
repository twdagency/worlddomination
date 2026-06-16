import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DashboardScreen } from '../screens/DashboardScreen';
import { DispatchesScreen } from '../screens/DispatchesScreen';
import { HOME_STACK_SCREEN_OPTIONS } from './homeStackConfig';
import type { HomeStackParamList } from './types';

const Stack = createNativeStackNavigator<HomeStackParamList>();

export function HomeStackNavigator() {
  return (
    <Stack.Navigator screenOptions={HOME_STACK_SCREEN_OPTIONS}>
      <Stack.Screen name="DashboardHome" component={DashboardScreen} />
      <Stack.Screen name="Dispatches" component={DispatchesScreen} />
    </Stack.Navigator>
  );
}
