import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useGame } from '../game/GameContext';
import { LandingScreen } from '../screens/LandingScreen';
import { terminal } from '../theme/terminal';
import { RootTabs } from './RootTabs';

export function AppShell() {
  const { ready, sessionPhase } = useGame();

  if (!ready) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={terminal.accent} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  if (sessionPhase === 'menu') {
    return <LandingScreen />;
  }

  return <RootTabs />;
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
