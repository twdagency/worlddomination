import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGame } from '../game/GameContext';
import { DEFAULT_SCENARIO_ID } from '../game/scenarios';
import { DevScenarioSelector } from '../components/DevScenarioSelector';
import { landingActions } from './landingMenu';
import { terminal } from '../theme/terminal';

type LandingView = 'home' | 'options';

export function LandingScreen() {
  const insets = useSafeAreaInsets();
  const {
    hasSavedCampaign,
    startCampaign,
    continueCampaign,
    resetSavedCampaign,
    scenarioId,
  } = useGame();
  const [view, setView] = useState<LandingView>('home');

  if (view === 'options') {
    return (
      <View style={[styles.shell, { paddingTop: insets.top + 32, paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.kicker}>Command</Text>
        <Text style={styles.title}>Options</Text>
        <Text style={styles.blurb}>
          Tutorial time runs at 30× so marches resolve in minutes. Full campaigns run at 1×.
        </Text>
        {hasSavedCampaign ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Reset saved campaign"
            testID="landing-reset-save"
            onPress={() => void resetSavedCampaign()}
            style={({ pressed }) => [styles.button, styles.dangerButton, pressed && styles.pressed]}
          >
            <Text style={styles.dangerLabel}>Reset saved campaign</Text>
            <Text style={styles.buttonHint}>Clears the current save on this device.</Text>
          </Pressable>
        ) : null}
        <DevScenarioSelector />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to main menu"
          testID="landing-options-back"
          onPress={() => setView('home')}
          style={({ pressed }) => [styles.button, pressed && styles.pressed]}
        >
          <Text style={styles.buttonLabel}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.shell, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
      <Text style={styles.kicker}>World Domination</Text>
      <Text style={styles.title}>Command Briefing</Text>
      <Text style={styles.blurb}>
        Direct one country. March armies, govern cities, and outpace rival courts.
      </Text>

      {landingActions(hasSavedCampaign).map((action, index) => {
        const primary = index === 0;
        const hint =
          action.id === 'continue'
            ? `Resume ${scenarioId === 'tutorial' ? 'tutorial' : 'campaign'}.`
            : action.id === 'start'
              ? 'Europe campaign at standard speed.'
              : action.id === 'tutorial'
                ? 'Channel March · 30× time.'
                : undefined;
        const onPress =
          action.id === 'continue'
            ? () => void continueCampaign()
            : action.id === 'start'
              ? () => void startCampaign(DEFAULT_SCENARIO_ID)
              : action.id === 'tutorial'
                ? () => void startCampaign('tutorial')
                : () => setView('options');
        return (
          <Pressable
            key={action.id}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            testID={`landing-${action.id === 'start' ? 'start-game' : action.id === 'tutorial' ? 'play-tutorial' : action.id}`}
            onPress={onPress}
            style={({ pressed }) => [
              styles.button,
              primary && styles.primaryButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={primary ? styles.primaryLabel : styles.buttonLabel}>{action.label}</Text>
            {hint ? <Text style={styles.buttonHint}>{hint}</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: terminal.bg,
    paddingHorizontal: 24,
    justifyContent: 'center',
    gap: 12,
  },
  kicker: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 12,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  title: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  blurb: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  button: {
    backgroundColor: terminal.card,
    borderColor: terminal.border,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  primaryButton: {
    borderColor: terminal.accent,
  },
  dangerButton: {
    borderColor: terminal.danger,
  },
  pressed: {
    opacity: 0.75,
  },
  buttonLabel: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 16,
    fontWeight: '700',
  },
  primaryLabel: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 16,
    fontWeight: '700',
  },
  dangerLabel: {
    color: terminal.danger,
    fontFamily: terminal.mono,
    fontSize: 16,
    fontWeight: '700',
  },
  buttonHint: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginTop: 4,
  },
});
