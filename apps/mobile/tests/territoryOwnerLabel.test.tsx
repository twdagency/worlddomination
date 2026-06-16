import React, { act } from 'react';
import { describe, expect, it } from 'vitest';
import TestRenderer from 'react-test-renderer';
import { Text } from 'react-native';
import { createSprint4World, LEADERS_BY_ID, UNIT_TYPES_BY_ID } from 'shared';
import { ensureWorldMigrations } from 'sim';
import { TerritoryOwnerLabel } from '../src/components/TerritoryOwnerLabel';

const START_MS = 1_700_000_000_000;
const PARIS = 'territory-paris';
const ROME = 'faction-rome';

function migrate(world: ReturnType<typeof createSprint4World>) {
  return ensureWorldMigrations(world, {
    leaders: LEADERS_BY_ID,
    unitTypes: UNIT_TYPES_BY_ID,
  });
}

describe('TerritoryOwnerLabel component', () => {
  it('renders defeated-country muted styling', () => {
    const world = migrate(createSprint4World(START_MS));
    const withDefeatedOwner = {
      ...world,
      countries: {
        ...world.countries!,
        [ROME]: {
          ...world.countries![ROME]!,
          defeated: true,
        },
      },
    };

    let tree!: TestRenderer.ReactTestRenderer;
    act(() => {
      tree = TestRenderer.create(
        <TerritoryOwnerLabel world={withDefeatedOwner} territoryId={PARIS} variant="inline" />,
      );
    });

    const label = tree.root.findAllByType(Text)[0]!;
    expect(label.props.children).toBe('Paris (Rome)');
    expect(label.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ fontStyle: 'italic' })]),
    );
  });
});
