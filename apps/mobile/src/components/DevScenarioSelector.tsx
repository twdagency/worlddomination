import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useGame } from '../game/GameContext';
import { showDevControls } from '../game/devFlag';
import { DEV_SCENARIOS } from '../game/scenarios';
import { terminal } from '../theme/terminal';

export function DevScenarioSelector() {
  if (!showDevControls) return null;

  const { scenarioId, loadScenario } = useGame();

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>[DEV] Scenario</Text>
      {DEV_SCENARIOS.map((scenario) => {
        const active = scenario.id === scenarioId;
        return (
          <Pressable
            key={scenario.id}
            style={[styles.button, active && styles.active]}
            onPress={() => void loadScenario(scenario.id)}
          >
            <Text style={[styles.label, active && styles.labelActive]}>{scenario.label}</Text>
            <Text style={styles.blurb}>{scenario.blurb}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginBottom: 8,
    gap: 6,
  },
  title: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  button: {
    backgroundColor: terminal.card,
    borderColor: terminal.border,
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  active: {
    borderColor: terminal.accent,
  },
  label: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 13,
    fontWeight: '600',
  },
  labelActive: {
    color: terminal.accent,
  },
  blurb: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 11,
    marginTop: 4,
  },
});
