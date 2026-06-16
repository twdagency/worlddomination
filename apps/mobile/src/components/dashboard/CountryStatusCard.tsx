import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { CountryView } from '../../game/countrySelector';
import { TerminalCard } from '../TerminalCard';
import { terminal } from '../../theme/terminal';

interface CountryStatusCardProps {
  country: CountryView;
}

export function CountryStatusCard({ country }: CountryStatusCardProps) {
  const cityCount = country.cities.length;
  const cityNames =
    country.cities.length > 0
      ? country.cities.map((city) => (city.isCapital ? `★ ${city.name}` : city.name)).join(', ')
      : 'No cities';

  return (
    <TerminalCard testID="dashboard-country-status">
      <Text style={styles.label}>Country Status</Text>
      <Text style={styles.countryName}>{country.name}</Text>
      <Text style={styles.leader}>Led by {country.leaderName}</Text>
      <Text style={styles.stat}>Capital: {country.capitalName}</Text>
      <Text style={styles.stat}>
        Cities: {cityCount} — {cityNames}
      </Text>
      {country.defeated ? (
        <View style={styles.defeatedBanner}>
          <Text style={styles.defeatedText}>DEFEATED</Text>
        </View>
      ) : null}
    </TerminalCard>
  );
}

const styles = StyleSheet.create({
  label: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  countryName: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 16,
    fontWeight: '700',
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
  defeatedBanner: {
    marginTop: 10,
    borderColor: terminal.danger,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  defeatedText: {
    color: terminal.danger,
    fontFamily: terminal.mono,
    fontSize: 12,
    fontWeight: '700',
  },
});
