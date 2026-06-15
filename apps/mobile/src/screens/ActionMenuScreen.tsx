import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ACTION_MENU_ITEMS } from '../navigation/tabConfig';
import type { ActionStackParamList } from '../navigation/types';
import { TerminalCard } from '../components/TerminalCard';
import { terminal } from '../theme/terminal';

type Props = NativeStackScreenProps<ActionStackParamList, 'ActionMenu'>;

export function ActionMenuScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Actions</Text>
      <Text style={styles.hint}>Task screens — header stays visible while you work.</Text>

      <View style={styles.grid}>
        {ACTION_MENU_ITEMS.map((item) => (
          <Pressable
            key={item.screen}
            style={styles.cell}
            onPress={() => navigation.navigate(item.screen)}
          >
            <TerminalCard style={styles.card}>
              <Ionicons name={item.iconName as keyof typeof Ionicons.glyphMap} size={22} color={terminal.accent} />
              <Text style={styles.label}>{item.label}</Text>
            </TerminalCard>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: terminal.bg,
    padding: 16,
  },
  heading: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  hint: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cell: {
    width: '48%',
    minHeight: 88,
  },
  card: {
    flex: 1,
    minHeight: 88,
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 13,
    fontWeight: '700',
  },
});
