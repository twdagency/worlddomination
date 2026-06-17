import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { InfluenceSummaryView } from '../../game/influenceSelector';
import { INFLUENCE_CARD_FIRST_VIEW_TOOLTIP } from '../../game/influenceTooltips';
import { formatInfluenceValue } from '../../game/influenceDisplay';
import { TooltipAnchor } from '../tooltip/TooltipAnchor';
import { TerminalCard } from '../TerminalCard';
import { terminal } from '../../theme/terminal';

interface InfluenceCardProps {
  summary: InfluenceSummaryView;
  onOpenCity?: (cityId: string) => void;
  onOpenInfluence?: () => void;
}

export function InfluenceCard({ summary, onOpenCity, onOpenInfluence }: InfluenceCardProps) {
  const empty = summary.activeCityCount === 0;

  const card = (
    <TerminalCard testID="dashboard-influence-card">
      <Text style={styles.label}>Influence</Text>
      {empty ? (
        <Text style={styles.empty} testID="dashboard-influence-empty">
          Build influence through alliances, scouts, and diplomatic missions.
        </Text>
      ) : (
        <>
          <Text style={styles.summary} testID="dashboard-influence-summary">
            {summary.summaryLine}
          </Text>
          {summary.topTarget ? (
            <Pressable
              onPress={() => onOpenCity?.(summary.topTarget!.cityId)}
              accessibilityRole="button"
              testID="dashboard-influence-top-target"
            >
              <View style={styles.topTarget}>
                <Text style={styles.topTitle}>
                  {summary.topTarget.cityName} — {formatInfluenceValue(summary.topTarget.playerInfluence)}
                </Text>
                <Text style={styles.topSub}>
                  {summary.topTarget.countryName} · tap for detail
                </Text>
              </View>
            </Pressable>
          ) : null}
        </>
      )}
      <Pressable
        onPress={onOpenInfluence}
        style={styles.linkButton}
        accessibilityRole="button"
        testID="dashboard-influence-open-actions"
      >
        <Text style={styles.linkLabel}>
          {empty ? 'Open influence actions →' : 'Manage influence →'}
        </Text>
      </Pressable>
    </TerminalCard>
  );

  if (!empty) {
    return (
      <TooltipAnchor
        tooltip={INFLUENCE_CARD_FIRST_VIEW_TOOLTIP}
        trigger="first-mount"
        enabled={summary.activeCityCount > 0}
        mountDelayMs={500}
      >
        {card}
      </TooltipAnchor>
    );
  }

  return card;
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
  empty: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 13,
    lineHeight: 18,
  },
  summary: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 13,
    lineHeight: 18,
  },
  topTarget: {
    marginTop: 10,
    borderColor: terminal.border,
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    gap: 4,
  },
  topTitle: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 14,
    fontWeight: '700',
  },
  topSub: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
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
