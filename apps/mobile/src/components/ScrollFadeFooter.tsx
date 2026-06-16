import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { terminal } from '../theme/terminal';

interface ScrollFadeFooterProps {
  testID?: string;
}

/** Subtle bottom fade hinting that more content is scrollable below. */
export function ScrollFadeFooter({ testID }: ScrollFadeFooterProps) {
  return (
    <View pointerEvents="none" style={styles.wrap} testID={testID}>
      <LinearGradient
        colors={['transparent', terminal.bg]}
        style={styles.gradient}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 40,
  },
  gradient: {
    flex: 1,
  },
});
