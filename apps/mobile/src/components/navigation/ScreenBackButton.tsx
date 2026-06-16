import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { terminal } from '../../theme/terminal';

interface ScreenBackButtonProps {
  label?: string;
}

export function ScreenBackButton({ label = 'Actions' }: ScreenBackButtonProps) {
  const navigation = useNavigation();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Back to ${label}`}
      style={styles.back}
      onPress={() => navigation.goBack()}
    >
      <Ionicons name="chevron-back" size={22} color={terminal.accent} />
      <Text style={styles.backText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 12,
    gap: 2,
  },
  backText: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 14,
  },
});
