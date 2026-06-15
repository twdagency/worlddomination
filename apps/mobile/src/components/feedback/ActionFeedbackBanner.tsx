import React from 'react';
import { StyleSheet, Text } from 'react-native';
import type { ActionFeedback, ActionKind } from '../../game/actionFeedback';
import { TerminalCard } from '../TerminalCard';
import { terminal } from '../../theme/terminal';

interface ActionFeedbackBannerProps {
  action: ActionKind | ActionKind[];
  feedback: ActionFeedback | null;
}

export function ActionFeedbackBanner({ action, feedback }: ActionFeedbackBannerProps) {
  if (!feedback) return null;
  const actions = Array.isArray(action) ? action : [action];
  if (!actions.includes(feedback.action)) return null;

  return (
    <TerminalCard style={feedback.inline.isError ? styles.error : styles.success}>
      <Text style={styles.label}>{feedback.inline.isError ? 'Action blocked' : 'Action recorded'}</Text>
      <Text style={styles.body}>{feedback.inline.summary}</Text>
    </TerminalCard>
  );
}

const styles = StyleSheet.create({
  success: {
    borderColor: terminal.accent,
    marginBottom: 12,
  },
  error: {
    borderColor: terminal.danger,
    marginBottom: 12,
  },
  label: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  body: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 13,
    lineHeight: 18,
  },
});
