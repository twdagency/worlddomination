import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { CountryView } from '../../game/countrySelector';
import { DefeatedCountryBadge } from '../country/DefeatedCountryBadge';
import { formatDefeatedLeaderLabel } from '../../game/defeatedCountrySelector';
import { TerminalCard } from '../TerminalCard';
import { terminal } from '../../theme/terminal';

interface CountryStatusCardProps {
  country: CountryView;
  defeatedCount: number;
  onViewDefeated?: () => void;
}

export function CountryStatusCard({
  country,
  defeatedCount,
  onViewDefeated,
}: CountryStatusCardProps) {
  const cityCount = country.cities.length;
  const cityNames =
    country.cities.length > 0
      ? country.cities.map((city) => (city.isCapital ? `★ ${city.name}` : city.name)).join(', ')
      : 'No cities';
  const muted = country.defeated;

  return (
    <TerminalCard testID="dashboard-country-status" style={muted ? styles.mutedCard : undefined}>
      <Text style={styles.label}>Empire Status</Text>
      <View style={styles.titleRow}>
        <Text style={[styles.countryName, muted && styles.mutedText]}>{country.name}</Text>
        {country.defeated ? <DefeatedCountryBadge /> : null}
      </View>
      <Text style={[styles.leader, muted && styles.mutedText]}>
        {country.defeated
          ? formatDefeatedLeaderLabel(country.leaderName)
          : `Led by ${country.leaderName}`}
      </Text>
      <Text style={[styles.stat, muted && styles.mutedText]}>Capital: {country.capitalName}</Text>
      <Text style={[styles.stat, muted && styles.mutedText]}>
        Cities: {cityCount} — {cityNames}
      </Text>
      {country.defeated ? (
        <View style={styles.fallenBanner} testID="player-country-fallen-banner">
          <Text style={styles.fallenText}>Your country has fallen</Text>
        </View>
      ) : null}
      {defeatedCount > 0 && onViewDefeated ? (
        <Pressable
          onPress={onViewDefeated}
          style={styles.linkButton}
          accessibilityRole="button"
          accessibilityLabel={`View ${defeatedCount} defeated ${defeatedCount === 1 ? 'country' : 'countries'}`}
          testID="empire-status-defeated-link"
        >
          <Text style={styles.linkLabel}>
            View {defeatedCount} defeated {defeatedCount === 1 ? 'country' : 'countries'}
          </Text>
        </Pressable>
      ) : null}
    </TerminalCard>
  );
}

const styles = StyleSheet.create({
  mutedCard: {
    opacity: 0.75,
    borderColor: terminal.stale,
  },
  label: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  countryName: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 16,
    fontWeight: '700',
  },
  mutedText: {
    color: terminal.stale,
  },
  leader: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 13,
    marginTop: 4,
  },
  stat: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
  },
  fallenBanner: {
    marginTop: 10,
    borderColor: terminal.danger,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#1a1010',
  },
  fallenText: {
    color: terminal.danger,
    fontFamily: terminal.mono,
    fontSize: 13,
    fontWeight: '700',
  },
  linkButton: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  linkLabel: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 12,
    fontWeight: '700',
  },
});
