import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { terminal } from '../../theme/terminal';
import type { AnchorLayout, TooltipDefinition } from './types';

interface TooltipOverlayProps {
  visible: boolean;
  tooltip: TooltipDefinition | null;
  anchor: AnchorLayout | null;
  reducedMotion: boolean;
  onDismiss: () => void;
}

export function TooltipOverlay({
  visible,
  tooltip,
  anchor,
  reducedMotion,
  onDismiss,
}: TooltipOverlayProps) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  if (!tooltip) return null;

  const cardWidth = Math.min(windowWidth - 32, 320);
  const anchorBottom = anchor ? anchor.y + anchor.height : windowHeight * 0.35;
  const preferBelow = anchor ? anchorBottom + 140 < windowHeight : true;
  const top = anchor
    ? preferBelow
      ? anchor.y + anchor.height + 8
      : Math.max(16, anchor.y - 8 - 120)
    : windowHeight * 0.35;
  const left = anchor
    ? Math.min(Math.max(16, anchor.x), windowWidth - cardWidth - 16)
    : (windowWidth - cardWidth) / 2;

  return (
    <Modal
      visible={visible}
      transparent
      animationType={reducedMotion ? 'none' : 'fade'}
      onRequestClose={onDismiss}
      testID="tooltip-overlay"
    >
      <Pressable
        style={styles.backdrop}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss tooltip"
        testID="tooltip-backdrop"
      >
        <Pressable
          style={[styles.card, { width: cardWidth, top, left }]}
          onPress={(event) => event.stopPropagation()}
          testID={`tooltip-card-${tooltip.id}`}
        >
          <View style={styles.header}>
            {tooltip.title ? <Text style={styles.title}>{tooltip.title}</Text> : null}
            {tooltip.dismissable ? (
              <Pressable
                onPress={onDismiss}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Close tooltip"
                testID="tooltip-dismiss"
              >
                <Ionicons name="close" size={18} color={terminal.muted} />
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.body}>{tooltip.body}</Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    zIndex: 1000,
  },
  card: {
    position: 'absolute',
    backgroundColor: terminal.card,
    borderColor: terminal.accent,
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    flex: 1,
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  body: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 13,
    lineHeight: 19,
  },
});
