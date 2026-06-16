import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, type TextProps } from 'react-native';
import { terminal } from '../../theme/terminal';

interface LinkTextProps {
  children: string;
  onPress: () => void;
  testID?: string;
  numberOfLines?: TextProps['numberOfLines'];
}

export function LinkText({ children, onPress, testID, numberOfLines }: LinkTextProps) {
  const [pressed, setPressed] = useState(false);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      accessibilityRole="link"
      accessibilityLabel={children}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      style={styles.hit}
      testID={testID}
    >
      <Text
        style={[styles.link, pressed && styles.linkPressed]}
        numberOfLines={numberOfLines}
      >
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  link: {
    color: terminal.tutorial,
    fontFamily: terminal.mono,
    fontSize: 14,
    fontWeight: '700',
  },
  linkPressed: {
    textDecorationLine: 'underline',
    color: terminal.accent,
  },
});
