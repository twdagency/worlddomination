import React from 'react';
import { StyleSheet, Text } from 'react-native';
import { terminal } from '../../theme/terminal';
import { TooltipAnchor } from './TooltipAnchor';
import type { TooltipDefinition } from './types';

interface TooltipInfoIconProps {
  tooltip: TooltipDefinition;
  testID?: string;
}

export function TooltipInfoIcon({ tooltip, testID }: TooltipInfoIconProps) {
  return (
    <TooltipAnchor tooltip={tooltip} trigger="tap">
      <Text style={styles.icon} testID={testID ?? `tooltip-info-${tooltip.id}`}>
        (i)
      </Text>
    </TooltipAnchor>
  );
}

const styles = StyleSheet.create({
  icon: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 12,
    fontWeight: '700',
    marginLeft: 6,
  },
});
