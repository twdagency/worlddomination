import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { TerminalCard } from '../TerminalCard';
import { terminal } from '../../theme/terminal';

interface ExpandableRowProps {
  rowId: string;
  title: string;
  subtitle?: string;
  expanded: boolean;
  highlighted?: boolean;
  onToggle: (rowId: string) => void;
  secondary?: React.ReactNode;
  tertiary?: React.ReactNode;
}

export function ExpandableRow({
  rowId,
  title,
  subtitle,
  expanded,
  highlighted = false,
  onToggle,
  secondary,
  tertiary,
}: ExpandableRowProps) {
  return (
    <Pressable onPress={() => onToggle(rowId)}>
      <TerminalCard
        style={[
          highlighted ? styles.highlighted : undefined,
          expanded ? styles.expanded : undefined,
        ]}
      >
        <View style={styles.header}>
          <View style={styles.titles}>
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          <Text style={styles.chevron}>{expanded ? '▾' : '▸'}</Text>
        </View>

        {expanded && secondary ? <View style={styles.secondary}>{secondary}</View> : null}
        {expanded && tertiary ? <View style={styles.tertiary}>{tertiary}</View> : null}
      </TerminalCard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  highlighted: {
    borderColor: terminal.warning,
  },
  expanded: {
    borderColor: terminal.accent,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
    gap: 8,
  },
  titles: {
    flex: 1,
  },
  title: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 14,
    fontWeight: '700',
  },
  subtitle: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  chevron: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 16,
    fontWeight: '700',
  },
  secondary: {
    borderTopWidth: 1,
    borderTopColor: terminal.border,
    marginTop: 10,
    paddingTop: 10,
    gap: 6,
  },
  tertiary: {
    borderTopWidth: 1,
    borderTopColor: terminal.border,
    marginTop: 8,
    paddingTop: 8,
    gap: 4,
  },
});
