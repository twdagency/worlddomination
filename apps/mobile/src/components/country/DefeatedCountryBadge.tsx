import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { terminal } from '../../theme/terminal';

interface DefeatedCountryBadgeProps {
  testID?: string;
}

export function DefeatedCountryBadge({ testID = 'defeated-country-badge' }: DefeatedCountryBadgeProps) {
  return (
    <View style={styles.badge} testID={testID}>
      <Text style={styles.label}>Defeated</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderColor: terminal.stale,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
  },
  label: {
    color: terminal.stale,
    fontFamily: terminal.mono,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
