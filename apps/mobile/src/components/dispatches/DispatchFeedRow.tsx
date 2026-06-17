import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DispatchFeedItem } from 'sim';
import { BattleDetailCard } from '../BattleDetailCard';
import { IntelSourceHint } from '../IntelSourceHint';
import { TerminalCard } from '../TerminalCard';
import { terminal } from '../../theme/terminal';
import { formatDateTime } from '../../utils/format';
import { isDispatchDetailEvent } from '../../game/actions';

function dispatchAccent(kind: string): string {
  if (kind === 'battle') return terminal.danger;
  if (kind === 'withdrawal') return terminal.warning;
  if (kind === 'secured') return terminal.accent;
  if (kind === 'income' || kind === 'production' || kind === 'buildStarted' || kind === 'infraUpgraded') {
    return terminal.accent;
  }
  if (kind === 'intelReport') return terminal.text;
  if (kind === 'buildBlocked') return terminal.warning;
  return terminal.text;
}

interface DispatchFeedRowProps {
  item: DispatchFeedItem;
  world: Parameters<typeof BattleDetailCard>[0]['world'];
  expanded?: boolean;
  highlighted?: boolean;
  onPress?: () => void;
  testID?: string;
}

export function DispatchFeedRow({
  item,
  world,
  expanded = false,
  highlighted = false,
  onPress,
  testID,
}: DispatchFeedRowProps) {
  const showDetail = isDispatchDetailEvent(item.event) && item.event.kind === 'battle';
  const content = (
    <TerminalCard style={highlighted ? styles.highlighted : undefined}>
      {item.header ? <Text style={styles.beatHeader}>{item.header}</Text> : null}
      {'at' in item.event && typeof item.event.at === 'number' ? (
        <Text style={styles.timestamp}>{formatDateTime(item.event.at)}</Text>
      ) : null}
      <Text style={[styles.line, { color: dispatchAccent(item.event.kind) }]}>{item.line}</Text>
      {item.event.kind === 'intelReport' ? (
        <IntelSourceHint sources={[item.event.source]} />
      ) : null}
      {expanded && item.event.kind === 'battle' ? (
        <BattleDetailCard
          report={item.event.report}
          territoryId={item.event.territoryId}
          world={world}
        />
      ) : null}
    </TerminalCard>
  );

  if (!onPress) return <View testID={testID}>{content}</View>;

  return (
    <Pressable onPress={onPress} testID={testID}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  highlighted: {
    borderColor: terminal.accent,
  },
  timestamp: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 11,
    marginBottom: 6,
  },
  beatHeader: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  line: {
    fontFamily: terminal.mono,
    fontSize: 14,
    lineHeight: 20,
  },
});
