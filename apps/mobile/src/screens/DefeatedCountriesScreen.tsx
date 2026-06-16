import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useGame } from '../game/GameContext';
import { DefeatedCountryBadge } from '../components/country/DefeatedCountryBadge';
import {
  formatDefeatedLeaderLabel,
  selectDefeatedCountries,
  type DefeatedCountryView,
} from '../game/defeatedCountrySelector';
import { ScreenBackButton } from '../components/navigation/ScreenBackButton';
import { TerminalCard } from '../components/TerminalCard';
import { formatDateTime } from '../utils/format';
import { terminal } from '../theme/terminal';

function DefeatedCountryCard({ country }: { country: DefeatedCountryView }) {
  const [expanded, setExpanded] = useState(false);
  const allianceText =
    country.formerAlliances.length > 0
      ? country.formerAlliances.map((ally) => ally.name).join(', ')
      : 'None recorded';

  return (
    <Pressable
      onPress={() => setExpanded((current) => !current)}
      testID={`defeated-country-card-${country.id}`}
    >
      <TerminalCard style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.countryName}>{country.name}</Text>
          <DefeatedCountryBadge />
        </View>
        <Text style={styles.muted}>{formatDefeatedLeaderLabel(country.leaderName)}</Text>
        <Text style={styles.stat}>
          Defeated by {country.defeatedByName ?? 'unknown conqueror'}
        </Text>
        {country.finalTerritoryName ? (
          <Text style={styles.stat}>Final territory: {country.finalTerritoryName}</Text>
        ) : null}
        {expanded ? (
          <View style={styles.detail} testID={`defeated-country-detail-${country.id}`}>
            {country.defeatedAt ? (
              <Text style={styles.stat}>Defeated on {formatDateTime(country.defeatedAt)}</Text>
            ) : null}
            {country.formerCapitalName ? (
              <Text style={styles.stat}>Former capital: {country.formerCapitalName}</Text>
            ) : null}
            <Text style={styles.stat}>Former alliances: {allianceText}</Text>
          </View>
        ) : (
          <Text style={styles.expandHint}>Tap for historical detail</Text>
        )}
      </TerminalCard>
    </Pressable>
  );
}

export function DefeatedCountriesScreen() {
  const { world } = useGame();
  const defeated = selectDefeatedCountries(world);

  return (
    <View style={styles.container}>
      <ScreenBackButton label="Back" />
      <Text style={styles.heading}>Defeated Countries</Text>
      <Text style={styles.hint}>
        Historical record — fallen powers remain in the campaign archive.
      </Text>
      <FlatList
        data={defeated}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <TerminalCard>
            <Text style={styles.muted}>No defeated countries yet.</Text>
          </TerminalCard>
        }
        renderItem={({ item }) => <DefeatedCountryCard country={item} />}
        testID="defeated-countries-list"
      />
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
    marginBottom: 8,
  },
  hint: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 12,
  },
  list: {
    gap: 12,
    paddingBottom: 24,
  },
  card: {
    opacity: 0.85,
    borderColor: terminal.stale,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  countryName: {
    color: terminal.stale,
    fontFamily: terminal.mono,
    fontSize: 16,
    fontWeight: '700',
  },
  muted: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 13,
    lineHeight: 18,
  },
  stat: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  detail: {
    marginTop: 8,
    gap: 2,
  },
  expandHint: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 11,
    marginTop: 8,
  },
});
