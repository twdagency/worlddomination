import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DashboardNavTarget, DashboardUrgentItem } from '../../game/playerView';
import { TerminalCard } from '../TerminalCard';
import { terminal } from '../../theme/terminal';

interface UrgentQueueProps {
  items: DashboardUrgentItem[];
  onNavigate: (target: DashboardNavTarget) => void;
}

export function UrgentQueue({ items, onNavigate }: UrgentQueueProps) {
  if (items.length === 0) {
    return (
      <TerminalCard>
        <Text style={styles.label}>Urgent queue</Text>
        <Text style={styles.empty}>No urgent matters</Text>
      </TerminalCard>
    );
  }

  return (
    <View>
      <Text style={styles.section}>Urgent queue</Text>
      {items.map((item) => (
        <Pressable key={item.id} onPress={() => onNavigate(item.navigation)}>
          <TerminalCard style={styles.row}>
            <Text style={styles.itemText}>{item.label}</Text>
            <Text style={styles.chevron}>›</Text>
          </TerminalCard>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  label: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  empty: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 13,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    minHeight: 44,
  },
  itemText: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 13,
    flex: 1,
    paddingRight: 8,
    lineHeight: 18,
  },
  chevron: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 18,
    fontWeight: '700',
  },
});
