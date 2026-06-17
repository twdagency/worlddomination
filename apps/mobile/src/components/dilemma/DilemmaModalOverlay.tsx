import React, { useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { Dilemma, DilemmaUrgency } from 'shared';
import { terminal } from '../../theme/terminal';

const FADE_MS = 250;

export interface DilemmaModalOverlayProps {
  visible: boolean;
  dilemma: Dilemma | null;
  urgency: DilemmaUrgency | null;
  canDismiss: boolean;
  onResolve: (optionId: string) => void;
  onDismiss: () => void;
}

export function DilemmaModalOverlay({
  visible,
  dilemma,
  urgency,
  canDismiss,
  onResolve,
  onDismiss,
}: DilemmaModalOverlayProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const isCrisis = urgency === 'crisis';

  useEffect(() => {
    let cancelled = false;
    const reduceMotionPromise =
      typeof AccessibilityInfo?.isReduceMotionEnabled === 'function'
        ? AccessibilityInfo.isReduceMotionEnabled()
        : Promise.resolve(false);
    void reduceMotionPromise.then((enabled) => {
      if (!cancelled) setReduceMotion(enabled);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!dilemma) return null;

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'fade'}
      transparent
      onRequestClose={canDismiss ? onDismiss : undefined}
      testID="dilemma-modal-overlay"
    >
      <View
        style={[
          styles.backdrop,
          isCrisis ? styles.backdropCrisis : styles.backdropStandard,
        ]}
      >
        <View style={[styles.panel, isCrisis ? styles.panelCrisis : styles.panelStandard]}>
          {canDismiss ? (
            <Pressable
              onPress={onDismiss}
              style={styles.dismissButton}
              accessibilityRole="button"
              accessibilityLabel="Dismiss dilemma"
              testID="dilemma-overlay-dismiss"
            >
              <Text style={styles.dismissLabel}>× Dismiss</Text>
            </Pressable>
          ) : null}

          <ScrollView contentContainerStyle={styles.content}>
            <Text style={[styles.title, isCrisis && styles.titleCrisis]}>{dilemma.title}</Text>
            <Text style={styles.prompt}>{dilemma.prompt}</Text>

            {dilemma.options.map((option) => (
              <View key={option.id} style={styles.optionCard} testID={`dilemma-option-${option.id}`}>
                <Text style={styles.optionLabel}>{option.label}</Text>
                <Text style={styles.optionDescription}>{option.description}</Text>
                <Pressable
                  style={styles.chooseButton}
                  onPress={() => onResolve(option.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Choose ${option.label}`}
                  testID={`dilemma-choose-${option.id}`}
                >
                  <Text style={styles.chooseLabel}>Choose</Text>
                </Pressable>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export const DILEMMA_MODAL_FADE_MS = FADE_MS;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
    backgroundColor: 'rgba(10, 14, 20, 0.5)',
  },
  backdropCrisis: {
    backgroundColor: 'rgba(10, 14, 20, 0.7)',
  },
  backdropStandard: {
    backgroundColor: 'rgba(10, 14, 20, 0.5)',
  },
  panel: {
    backgroundColor: terminal.bg,
    borderWidth: 1,
    borderRadius: 10,
    maxHeight: '90%',
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 8,
  },
  panelCrisis: {
    borderColor: terminal.warning,
    borderLeftWidth: 4,
  },
  panelStandard: {
    borderColor: terminal.border,
  },
  dismissButton: {
    alignSelf: 'flex-end',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
    marginBottom: 4,
  },
  dismissLabel: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 14,
  },
  content: {
    gap: 14,
    paddingBottom: 24,
  },
  title: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 28,
  },
  titleCrisis: {
    fontSize: 26,
    color: terminal.warning,
  },
  prompt: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 14,
    lineHeight: 22,
  },
  optionCard: {
    backgroundColor: terminal.card,
    borderColor: terminal.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 8,
  },
  optionLabel: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 15,
    fontWeight: '700',
  },
  optionDescription: {
    color: terminal.stale,
    fontFamily: terminal.mono,
    fontSize: 12,
    lineHeight: 18,
  },
  chooseButton: {
    alignSelf: 'flex-start',
    borderColor: terminal.accent,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 4,
  },
  chooseLabel: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 13,
    fontWeight: '700',
  },
});
