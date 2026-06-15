import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  areAllied,
  diplomaticRelationshipStatus,
  getActiveTreaties,
  pendingProposalsForFaction,
  playerFactionId,
  reputationCategory,
} from 'sim';
import { useGame } from '../game/GameContext';
import { PLAYER_FACTION_ID } from '../game/playerView';
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

export function DiplomacyScreen() {
  const {
    world,
    proposeAlliance,
    breakAlliance,
    proposeTreaty,
    acceptProposal,
    declineProposal,
  } = useGame();
  const [treatyTarget, setTreatyTarget] = useState<string | null>(null);

  const playerId = playerFactionId(world) ?? PLAYER_FACTION_ID;
  const incoming = pendingProposalsForFaction(world, playerId);

  const factions = useMemo(
    () =>
      Object.values(world.factions)
        .filter((faction) => faction.id !== playerId)
        .map((faction) => {
          const leader = world.leaders[faction.leaderId];
          const reputation = world.reputation[playerId]?.[faction.id] ?? 0;
          return {
            id: faction.id,
            name: leader?.name ?? faction.id,
            status: diplomaticRelationshipStatus(world, playerId, faction.id),
            reputationLabel: reputationCategory(reputation),
            reputation,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [world, playerId],
  );

  const activeTreaties = getActiveTreaties(world, playerId, world.nowMs);

  const treatyTerritories = Object.values(world.territories)
    .filter((territory) => territory.ownerId !== playerId)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <FlatList
      style={styles.container}
      contentContainerStyle={styles.content}
      data={factions}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={
        <View>
          <Text style={styles.title}>Diplomacy</Text>
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
      renderItem={({ item }) => (
        <TerminalCard>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.meta}>
            {statusLabel(item.status)} · {item.reputationLabel}
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
              <Text style={styles.pickerHint}>Select territory (48h default)</Text>
              {treatyTerritories.map((territory) => (
                <Pressable
                  key={territory.id}
                  style={styles.territoryRow}
                  onPress={() => {
                    setTreatyTarget(null);
                    void proposeTreaty(item.id, territory.id);
                  }}
                >
                  <Text style={styles.territoryName}>{territory.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </TerminalCard>
      )}
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
  name: {
    color: terminal.accent,
    fontFamily: terminal.mono,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  meta: {
    color: terminal.muted,
    fontFamily: terminal.mono,
    fontSize: 12,
    marginBottom: 10,
    textTransform: 'uppercase',
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
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: terminal.border,
    paddingTop: 8,
    gap: 4,
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
  territoryName: {
    color: terminal.text,
    fontFamily: terminal.mono,
    fontSize: 13,
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
