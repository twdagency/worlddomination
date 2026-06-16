import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRoute, type RouteProp } from '@react-navigation/native';
import {
  areAllied,
  computeStance,
  diplomaticRelationshipStatus,
  getActiveTreaties,
  pendingProposalsForFaction,
  playerFactionId,
  reputationCategory,
  STANCE_WINDOW_MS,
} from 'sim';
import { useGame } from '../game/GameContext';
import { isTimestampedDispatch } from '../game/actions';
import { formatStanceDetail, stanceColor } from '../game/diplomacyStanceDisplay';
import { getFactionIdentity } from '../game/factionDisplay';
import { toggleExpandedRow } from '../game/expandableRowState';
import { evaluateCostLines, treatyOfferLine } from '../game/costPreview';
import { ActionFeedbackBanner } from '../components/feedback/ActionFeedbackBanner';
import { CostBlock } from '../components/disclosure/CostBlock';
import { ExpandableRow } from '../components/disclosure/ExpandableRow';
import { resolvePlayerFactionId } from 'shared';
import { diplomacyTargetFactions } from '../game/diplomacySelector';
import type { ActionStackParamList } from '../navigation/types';
import { TerminalCard } from '../components/TerminalCard';
import { terminal } from '../theme/terminal';

function statusLabel(status: ReturnType<typeof diplomaticRelationshipStatus>): string {
  switch (status) {
    case 'allied':
      return 'Allied';
    case 'treaty-active':
      return 'Treaty in force';
    case 'proposal-incoming':
      return 'Proposal pending';
    default:
      return 'Neutral';
  }
}

function diplomacySortPriority(status: ReturnType<typeof diplomaticRelationshipStatus>): number {
  if (status === 'proposal-incoming') return 0;
  if (status === 'treaty-active') return 1;
  return 2;
}

type DiplomacyRoute = RouteProp<ActionStackParamList, 'Diplomacy'>;

export function DiplomacyScreen() {
  const route = useRoute<DiplomacyRoute>();
  const {
    world,
    dispatches,
    actionFeedback,
    proposeAlliance,
    breakAlliance,
    proposeTreaty,
    acceptProposal,
    declineProposal,
  } = useGame();
  const [treatyTarget, setTreatyTarget] = useState<string | null>(null);
  const [expandedFactionId, setExpandedFactionId] = useState<string | null>(null);

  const playerId = resolvePlayerFactionId(world) ?? playerFactionId(world);
  const incoming = playerId ? pendingProposalsForFaction(world, playerId) : [];
  const timestampedDispatches = dispatches.filter(isTimestampedDispatch);

  useEffect(() => {
    if (route.params?.expandFactionId) {
      setExpandedFactionId(route.params.expandFactionId);
    }
  }, [route.params?.expandFactionId]);

  const factions = useMemo(
    () =>
      diplomacyTargetFactions(world)
        .map((faction) => {
          const reputation = playerId ? (world.reputation[playerId]?.[faction.id] ?? 0) : 0;
          const stance = computeStance(
            world,
            faction.id,
            timestampedDispatches,
            world.nowMs,
            STANCE_WINDOW_MS,
          );
          return {
            id: faction.id,
            identity: getFactionIdentity(world, faction.id),
            status: playerId
              ? diplomaticRelationshipStatus(world, playerId, faction.id)
              : ('neutral' as const),
            reputationLabel: reputationCategory(reputation),
            reputation,
            stance,
          };
        })
        .sort((a, b) => {
          const priority = diplomacySortPriority(a.status) - diplomacySortPriority(b.status);
          return priority !== 0 ? priority : a.identity.leaderName.localeCompare(b.identity.leaderName);
        }),
    [world, playerId, timestampedDispatches],
  );

  const activeTreaties = playerId ? getActiveTreaties(world, playerId, world.nowMs) : [];

  const treatyTerritories = Object.values(world.territories)
    .filter((territory) => territory.ownerId !== playerId)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!playerId) {
    return (
      <View style={styles.container}>
        <Text style={styles.muted}>No player faction in this campaign.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={factions}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View>
          <Text style={styles.title}>Diplomacy</Text>
          <ActionFeedbackBanner
            action={['proposeAlliance', 'proposeTreaty', 'breakAlliance', 'acceptProposal', 'declineProposal']}
            feedback={actionFeedback}
          />
          <Text style={styles.hint}>
            Player actions are unconditional. AI acceptance uses reputation and posture only.
          </Text>
          {incoming.length > 0 && (
            <TerminalCard style={styles.incomingCard}>
              <Text style={styles.sectionLabel}>Incoming proposals</Text>
              {incoming.map((proposal) => {
                const fromName =
                  world.leaders[world.factions[proposal.from]?.leaderId ?? '']?.name ??
                  proposal.from;
                return (
                  <View key={proposal.id} style={styles.proposalRow}>
                    <Text style={styles.proposalText}>
                      {fromName} — {proposal.type}
                    </Text>
                    <View style={styles.row}>
                      <Pressable
                        style={styles.acceptButton}
                        onPress={() => void acceptProposal(proposal.id)}
                      >
                        <Text style={styles.buttonText}>Accept</Text>
                      </Pressable>
                      <Pressable
                        style={styles.declineButton}
                        onPress={() => void declineProposal(proposal.id)}
                      >
                        <Text style={styles.buttonText}>Decline</Text>
                      </Pressable>
                    </View>
                  </View>
                );
              })}
            </TerminalCard>
          )}
        </View>
      }
      ListFooterComponent={
        <TerminalCard style={styles.footer}>
          <Text style={styles.sectionLabel}>Active treaties</Text>
          {activeTreaties.length === 0 ? (
            <Text style={styles.muted}>None</Text>
          ) : (
            activeTreaties.map((treaty) => {
              const other =
                treaty.parties[0] === playerId ? treaty.parties[1] : treaty.parties[0];
              const otherName =
                world.leaders[world.factions[other]?.leaderId ?? '']?.name ?? other;
              const places = treaty.scope.territoryIds
                .map((id) => world.territories[id]?.name ?? id)
                .join(', ');
              const hoursLeft = Math.max(
                0,
                Math.round((treaty.expiresAt - world.nowMs) / 3_600_000),
              );
              return (
                <Text key={treaty.id} style={styles.treatyLine}>
                  {otherName} — {places} — {hoursLeft}h remaining
                </Text>
              );
            })
          )}
        </TerminalCard>
      }
      renderItem={({ item }) => {
        const expanded = expandedFactionId === item.id;
        const pending = item.status === 'proposal-incoming';

        return (
          <ExpandableRow
            rowId={item.id}
            title={item.identity.compactLine}
            subtitle={`${statusLabel(item.status)} · ${item.identity.citiesLine}`}
            expanded={expanded}
            highlighted={pending}
            onToggle={(id) => setExpandedFactionId((prev) => toggleExpandedRow(prev, id))}
            secondary={
              <View style={styles.secondary}>
                <Text style={[styles.stance, { color: stanceColor(item.stance) }]}>
                  {formatStanceDetail(item.stance)}
                </Text>
                <Text style={styles.secondaryHint}>
                  Derived from observed orders in the last 24 game-hours.
                </Text>
                <View style={styles.row}>
                  {!areAllied(world, playerId, item.id) && item.status !== 'proposal-incoming' && (
                    <Pressable
                      style={styles.actionButton}
                      onPress={() => void proposeAlliance(item.id)}
                    >
                      <Text style={styles.buttonText}>Propose alliance</Text>
                    </Pressable>
                  )}
                  {areAllied(world, playerId, item.id) && (
                    <Pressable
                      style={styles.dangerButton}
                      onPress={() => void breakAlliance(item.id)}
                    >
                      <Text style={styles.buttonText}>Break alliance</Text>
                    </Pressable>
                  )}
                  {!areAllied(world, playerId, item.id) && (
                    <Pressable
                      style={styles.actionButton}
                      onPress={() => setTreatyTarget(treatyTarget === item.id ? null : item.id)}
                    >
                      <Text style={styles.buttonText}>Propose treaty</Text>
                    </Pressable>
                  )}
                </View>
                {treatyTarget === item.id && (
                  <View style={styles.territoryPicker}>
                    <Text style={styles.pickerHint}>
                      Select territory to offer access (48h default)
                    </Text>
                    {treatyTerritories.map((territory) => (
                      <Pressable
                        key={territory.id}
                        style={styles.territoryRow}
                        onPress={() => {
                          setTreatyTarget(null);
                          void proposeTreaty(item.id, territory.id);
                        }}
                      >
                        <CostBlock
                          preview={evaluateCostLines([treatyOfferLine(territory.name)])}
                          title="Treaty offer"
                        />
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            }
            tertiary={
              <Text style={styles.tertiaryText}>
                Reputation: {item.reputation} ({item.reputationLabel}) · {item.identity.primaryLine}
              </Text>
            }
          />
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: terminal.bg,
  },
  content: {
    padding: 16,
    paddingBottom: 24,
    gap: 12,
  },
  title: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  hint: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginBottom: 12,
  },
  incomingCard: {
    marginBottom: 12,
    borderColor: terminal.warning,
  },
  sectionLabel: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  proposalRow: {
    marginBottom: 10,
    gap: 8,
  },
  proposalText: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 13,
  },
  secondary: {
    gap: 8,
  },
  stance: {
    fontFamily: terminal.mono,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  secondaryHint: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 11,
    lineHeight: 16,
  },
  tertiaryText: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 11,
    lineHeight: 16,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionButton: {
    borderWidth: 1,
    borderColor: terminal.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  acceptButton: {
    borderWidth: 1,
    borderColor: terminal.accent,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  declineButton: {
    borderWidth: 1,
    borderColor: terminal.danger,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dangerButton: {
    borderWidth: 1,
    borderColor: terminal.danger,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  buttonText: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 12,
  },
  territoryPicker: {
    marginTop: 4,
    borderTopWidth: 1,
    borderTopColor: terminal.border,
    paddingTop: 8,
    gap: 8,
  },
  pickerHint: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 11,
    marginBottom: 4,
  },
  territoryRow: {
    paddingVertical: 4,
  },
  footer: {
    marginTop: 8,
  },
  treatyLine: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginBottom: 4,
  },
  muted: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
  },
});
