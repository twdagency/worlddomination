import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BeatCopy } from 'shared';
import type { TutorialBannerMode } from '../../game/tutorialSelector';
import { ExpandableRow } from '../disclosure/ExpandableRow';
import { isRowExpanded, toggleExpandedRow } from '../../game/expandableRowState';
import { terminal } from '../../theme/terminal';

const WHY_ROW_ID = 'tutorial-why';

export interface TutorialBannerProps {
  copy: BeatCopy;
  mode: TutorialBannerMode;
  onDismiss: () => void;
  onExpand: () => void;
  onCollapse: () => void;
  isHandoffReady?: boolean;
  onGraduate?: () => void;
}

export function TutorialBanner({
  copy,
  mode,
  onDismiss,
  onExpand,
  onCollapse,
  isHandoffReady = false,
  onGraduate,
}: TutorialBannerProps) {
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  const collapsed = mode === 'collapsed';

  const toggleExpanded = () => {
    if (collapsed) {
      onExpand();
    } else {
      onCollapse();
    }
  };

  return (
    <View
      style={[styles.banner, collapsed && styles.bannerCollapsed]}
      testID="tutorial-banner"
    >
      <Pressable
        style={styles.titleRow}
        onPress={toggleExpanded}
        accessibilityRole="button"
        accessibilityLabel={collapsed ? 'Expand tutorial banner' : 'Collapse tutorial banner'}
        testID="tutorial-banner-toggle"
      >
        <Ionicons
          name={collapsed ? 'chevron-forward' : 'chevron-down'}
          size={16}
          color={terminal.tutorial}
          style={styles.chevron}
        />
        <Text style={styles.title} numberOfLines={collapsed ? 1 : undefined}>
          {copy.title}
        </Text>
        <Pressable
          onPress={onDismiss}
          hitSlop={8}
          style={styles.dismissButton}
          accessibilityRole="button"
          accessibilityLabel="Dismiss tutorial banner"
          testID="tutorial-banner-dismiss"
        >
          <Ionicons name="close" size={18} color={terminal.muted} />
        </Pressable>
      </Pressable>

      {!collapsed ? (
        <>
          {copy.intro ? <Text style={styles.intro}>{copy.intro}</Text> : null}
          <Text style={styles.body}>{copy.body}</Text>
          {copy.hint ? (
            <ExpandableRow
              rowId={WHY_ROW_ID}
              title="Why?"
              expanded={isRowExpanded(expandedRowId, WHY_ROW_ID)}
              onToggle={(rowId) => setExpandedRowId(toggleExpandedRow(expandedRowId, rowId))}
              secondary={<Text style={styles.hint}>{copy.hint}</Text>}
            />
          ) : null}
          {isHandoffReady && onGraduate ? (
            <Pressable
              style={styles.graduateButton}
              onPress={onGraduate}
              accessibilityRole="button"
              accessibilityLabel="Continue to Sandbox"
              testID="tutorial-graduate"
            >
              <Text style={styles.graduateLabel}>Continue to Sandbox</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: terminal.card,
    borderBottomWidth: 1,
    borderBottomColor: terminal.border,
    borderLeftWidth: 3,
    borderLeftColor: terminal.tutorial,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  bannerCollapsed: {
    minHeight: 44,
    paddingVertical: 10,
    gap: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chevron: {
    width: 16,
  },
  title: {
    flex: 1,
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  dismissButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -10,
    marginBottom: -10,
    marginRight: -10,
  },
  body: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    lineHeight: 18,
  },
  intro: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 12,
    lineHeight: 18,
  },
  hint: {
    color: terminal.stale,
    fontFamily: terminal.mono,
    fontSize: 12,
    lineHeight: 18,
  },
  graduateButton: {
    alignSelf: 'flex-start',
    backgroundColor: terminal.tutorial,
    borderRadius: 6,
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  graduateLabel: {
    color: terminal.bg,
    fontFamily: terminal.mono,
    fontSize: 13,
    fontWeight: '700',
  },
});
