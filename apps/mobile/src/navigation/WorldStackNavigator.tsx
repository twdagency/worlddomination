import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { WorldScreen } from '../screens/WorldScreen';
import { WORLD_STACK_SCREEN_OPTIONS } from './homeStackConfig';
import type { WorldStackParamList } from './types';

const Stack = createNativeStackNavigator<WorldStackParamList>();

export function WorldStackNavigator() {
  return (
    <Stack.Navigator screenOptions={WORLD_STACK_SCREEN_OPTIONS}>
      <Stack.Screen name="WorldHome" component={WorldScreen} />
    </Stack.Navigator>
  );
}
