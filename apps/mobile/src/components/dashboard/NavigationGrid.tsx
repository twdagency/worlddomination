import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DashboardNavCard, DashboardScreenName } from '../../game/playerView';
import { TerminalCard } from '../TerminalCard';
import { terminal } from '../../theme/terminal';

const SCREEN_ICONS: Record<DashboardNavCard['screen'], string> = {
  Dispatches: '✉',
  World: '◎',
  Order: '⚔',
  Diplomacy: '⚖',
  Territory: '⌂',
  Forces: '▣',
};

interface NavigationGridProps {
  cards: DashboardNavCard[];
  onNavigate: (screen: DashboardScreenName) => void;
}

export function NavigationGrid({ cards, onNavigate }: NavigationGridProps) {
  return (
    <View>
      <Text style={styles.section}>Task screens</Text>
      <View style={styles.grid}>
        {cards.map((card) => (
          <Pressable
            key={card.screen}
            style={styles.cell}
            onPress={() => onNavigate(card.screen)}
          >
            <TerminalCard style={styles.card}>
              <View style={styles.iconRow}>
                <Text style={styles.icon}>{SCREEN_ICONS[card.screen]}</Text>
                {card.badgeCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {card.badgeCount > 9 ? '9+' : String(card.badgeCount)}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.label}>{card.label}</Text>
            </TerminalCard>
          </Pressable>
        ))}
      </View>
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
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  icon: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 20,
  },
  label: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 13,
    fontWeight: '700',
  },
  badge: {
    backgroundColor: terminal.danger,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: terminal.bg,
    fontFamily: terminal.mono,
    fontSize: 10,
    fontWeight: '700',
  },
});
