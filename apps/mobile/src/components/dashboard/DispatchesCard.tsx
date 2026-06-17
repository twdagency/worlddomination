import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DashboardDispatchDigestItem } from '../../game/playerView';
import { TerminalCard } from '../TerminalCard';
import { terminal } from '../../theme/terminal';
import { formatDateTime } from '../../utils/format';

function dispatchAccent(kind: string): string {
  if (kind === 'battle') return terminal.danger;
  if (kind === 'withdrawal') return terminal.warning;
  if (kind === 'secured') return terminal.accent;
  return terminal.text;
}

interface DispatchesCardProps {
  items: DashboardDispatchDigestItem[];
  unreadCount: number;
  onOpenDispatch: (dispatchId: string) => void;
  onViewAll: () => void;
}

export function DispatchesCard({
  items,
  unreadCount,
  onOpenDispatch,
  onViewAll,
}: DispatchesCardProps) {
  return (
    <TerminalCard testID="dashboard-dispatches-card">
      <Pressable
        onPress={onViewAll}
        accessibilityRole="button"
        accessibilityLabel="View all dispatches"
        testID="dispatches-card-header"
      >
        <View style={styles.headerRow}>
          <Text style={styles.label}>Recent Dispatches</Text>
          {unreadCount > 0 ? (
            <View style={styles.badge} testID="dispatches-unread-badge">
              <Text style={styles.badgeText}>
                {unreadCount > 9 ? '9+' : String(unreadCount)}
              </Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      {items.length === 0 ? (
        <Text style={styles.empty}>No dispatches yet.</Text>
      ) : (
        items.map((item) => (
          <Pressable
            key={item.eventId}
            onPress={() => onOpenDispatch(item.eventId)}
            style={styles.row}
            testID={`dispatch-digest-${item.eventId}`}
          >
            <Text style={styles.timestamp}>{formatDateTime(item.atMs)}</Text>
            <Text style={[styles.line, { color: dispatchAccent(item.kind) }]} numberOfLines={2}>
              {item.line}
            </Text>
          </Pressable>
        ))
      )}

      {items.length > 0 ? (
        <Pressable
          onPress={onViewAll}
          style={styles.viewAll}
          accessibilityRole="button"
          accessibilityLabel="View all dispatches"
          testID="dispatches-view-all"
        >
          <Text style={styles.viewAllLabel}>View all →</Text>
        </Pressable>
      ) : null}
    </TerminalCard>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  label: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
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
  empty: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 13,
  },
  row: {
    borderTopColor: terminal.border,
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 10,
    gap: 4,
  },
  timestamp: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 11,
  },
  line: {
    fontFamily: terminal.mono,
    fontSize: 13,
    lineHeight: 18,
  },
  viewAll: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  viewAllLabel: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 13,
    fontWeight: '700',
  },
});
