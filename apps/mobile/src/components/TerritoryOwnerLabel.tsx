import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import type { Id, WorldState } from 'sim';
import { LinkText } from './navigation/LinkText';
import {
  resolveTerritoryOwnerLabel,
  type TerritoryOwnerLabelOptions,
  type TerritoryOwnerLabelVariant,
} from '../game/territoryOwnerLabel';
import type { DestinationStance } from '../game/orderDestinations';
import { classifyDestination } from '../game/orderDestinations';
import { terminal } from '../theme/terminal';

interface TerritoryOwnerLabelProps {
  world: WorldState;
  territoryId: Id;
  variant?: TerritoryOwnerLabelVariant;
  showLeader?: boolean;
  showStance?: boolean;
  stance?: DestinationStance;
  recommended?: boolean;
  playerId?: Id;
  ownerIdOverride?: Id;
  navigable?: boolean;
  onNavigate?: () => void;
  testID?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

function TerritoryOwnerLabelInner({
  world,
  territoryId,
  variant = 'inline',
  showLeader = false,
  showStance = false,
  stance,
  recommended,
  playerId,
  ownerIdOverride,
  navigable = false,
  onNavigate,
  testID,
  style,
  numberOfLines,
}: TerritoryOwnerLabelProps) {
  const resolved = useMemo(() => {
    const resolvedOwnerId =
      ownerIdOverride ?? world.territories[territoryId]?.ownerId;
    const resolvedStance: DestinationStance | undefined =
      stance ??
      (showStance && playerId
        ? classifyDestination(world, playerId, territoryId, resolvedOwnerId)
        : undefined);
    const options: TerritoryOwnerLabelOptions = {
      variant,
      showLeader,
      showStance,
      stance: resolvedStance,
      recommended,
      playerId,
      ownerIdOverride,
    };
    return resolveTerritoryOwnerLabel(world, territoryId, options);
  }, [
    world,
    territoryId,
    variant,
    showLeader,
    showStance,
    stance,
    recommended,
    playerId,
    ownerIdOverride,
  ]);

  const textStyle = [
    styles.base,
    resolved.defeated && styles.defeated,
    resolved.unclaimed && styles.unclaimed,
    style,
  ];

  if (navigable && onNavigate) {
    return (
      <LinkText
        testID={testID}
        onPress={onNavigate}
        numberOfLines={numberOfLines}
      >
        {resolved.text}
      </LinkText>
    );
  }

  return (
    <Text testID={testID} style={textStyle} numberOfLines={numberOfLines}>
      {resolved.text}
    </Text>
  );
}

export const TerritoryOwnerLabel = memo(TerritoryOwnerLabelInner);

const styles = StyleSheet.create({
  base: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 13,
  },
  defeated: {
    color: terminal.muted,
    fontStyle: 'italic',
  },
  unclaimed: {
    color: terminal.muted,
  },
});
