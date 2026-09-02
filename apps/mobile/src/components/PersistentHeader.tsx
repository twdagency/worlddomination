import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { resolvePlayerFactionId } from 'shared';
import { useGame } from '../game/GameContext';
import { getDashboardUnreadDispatchCount } from '../game/playerView';
import { navigateTo } from '../navigation/deepLinks';
import { rootNavigationRef } from '../navigation/navigationRef';
import { terminal } from '../theme/terminal';
import {
  formatAwayDuration,
  formatGameClockDate,
  formatGameClockTime,
  formatFunding,
} from '../utils/format';
import {
  buildPersistentHeaderModel,
  formatUrgentBadgeCount,
} from '../navigation/persistentHeaderModel';

export function PersistentHeader() {
  const insets = useSafeAreaInsets();
  const {
    world,
    dispatches,
    awayMs,
    dispatchReadState,
    isTutorialActive,
    isBannerDismissed,
    restoreBanner,
    returnToMenu,
  } = useGame();

  const playerId = resolvePlayerFactionId(world);
  const faction = playerId ? world.factions[playerId] : undefined;
  const urgentCount = getDashboardUnreadDispatchCount(
    world,
    dispatches,
    dispatchReadState,
  );
  const showTutorialRestore = isTutorialActive && isBannerDismissed;

  const model = buildPersistentHeaderModel({
    gameDay: world.day,
    gameDateLabel: formatGameClockDate(world.nowMs),
    gameTimeLabel: formatGameClockTime(world.nowMs),
    fundingLabel: formatFunding(faction?.funding ?? 0),
    awayMs,
    urgentCount,
    formatAwayDuration,
  });

  const badgeLabel = formatUrgentBadgeCount(model.urgentCount);

  return (
    <View style={[styles.shell, { paddingTop: insets.top }]}>
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={styles.date} numberOfLines={1}>
            Day {model.gameDay} · {model.gameDateLabel}
          </Text>
          <Text style={styles.time} numberOfLines={1}>
            {model.gameTimeLabel}
          </Text>
          {model.showAwayIndicator && model.awayLabel && (
            <Text style={styles.away} numberOfLines={1}>
              Away {model.awayLabel}
            </Text>
          )}
        </View>

        <View style={styles.right}>
          <Pressable
            style={styles.iconTap}
            hitSlop={8}
            onPress={() => {
              if (rootNavigationRef.isReady()) {
                navigateTo(rootNavigationRef as never, {
                  tab: 'home',
                  screen: 'dispatches',
                  unreadOnly: true,
                });
              }
            }}
            accessibilityLabel="Open unread dispatches"
          >
            {badgeLabel.length > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{badgeLabel}</Text>
              </View>
            )}
            <Ionicons name="notifications-outline" size={18} color={terminal.muted} />
          </Pressable>

          {showTutorialRestore ? (
            <Pressable
              style={styles.iconTap}
              hitSlop={8}
              onPress={restoreBanner}
              accessibilityRole="button"
              accessibilityLabel="Restore tutorial banner"
              testID="tutorial-banner-restore"
            >
              <Ionicons name="school-outline" size={18} color={terminal.tutorial} />
            </Pressable>
          ) : null}

          <Text style={styles.funding} numberOfLines={1}>
            {model.fundingLabel}
          </Text>

          <Pressable
            style={styles.iconTap}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Main menu"
            testID="header-main-menu"
            onPress={() => void returnToMenu()}
          >
            <Ionicons name="settings-outline" size={18} color={terminal.muted} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    backgroundColor: terminal.card,
    borderBottomWidth: 1,
    borderBottomColor: terminal.border,
    minHeight: 40,
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  left: {
    flexShrink: 1,
    flexGrow: 1,
    minWidth: 0,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  date: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 11,
  },
  time: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 11,
    marginTop: 1,
  },
  away: {
    color: terminal.warning,
    fontFamily: terminal.mono,
    fontSize: 10,
    marginTop: 2,
  },
  funding: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 11,
    fontWeight: '700',
    maxWidth: 72,
  },
  iconTap: {
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 4,
    backgroundColor: terminal.danger,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
    zIndex: 1,
  },
  badgeText: {
    color: terminal.bg,
    fontFamily: terminal.mono,
    fontSize: 9,
    fontWeight: '700',
  },
});
