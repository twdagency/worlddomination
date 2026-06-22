import type { TutorialBeatId } from 'sim';

export interface BeatCopy {
  beat: TutorialBeatId;
  title: string;
  body: string;
  hint?: string;
}

export const TUTORIAL_BEAT_COPY: Record<TutorialBeatId, BeatCopy> = {
  movement: {
    beat: 'movement',
    title: 'Send your forces to Paris',
    body: 'Open the Order screen and dispatch your London garrison to Paris. Marches take real time — at tutorial speed (30×), this arrives in minutes.',
    hint: 'Why: Every action in this game takes time. Watching the clock tick is part of the strategy. Tap the Actions tab → Order to begin.',
  },
  combat: {
    beat: 'combat',
    title: 'Capture Paris',
    body: 'When your forces arrive, they will engage the Paris garrison. Composition and numbers decide the outcome.',
    hint: 'Why: Combat in this game is strategic, not tactical. You commit forces; resolution happens automatically based on unit types, terrain, and leader traits.',
  },
  economy: {
    beat: 'economy',
    title: 'Build infrastructure in Paris',
    body: 'Open the Territory screen and queue an infrastructure upgrade. Higher infra means more income and stronger production.',
    hint: 'Why: Conquest is just the start. Held territory must be developed to generate the resources that fund further expansion.',
  },
  pinch: {
    beat: 'pinch',
    title: 'Food is running out',
    body: 'London and Paris cannot feed your forces. You have three paths: take Burgundy by force, negotiate a treaty with Burgundy, or build food infrastructure (slow).',
    hint: 'Why: Geography determines what your empire can do. Every resource has a location. Every shortage is a strategic prompt.',
  },
  governance: {
    beat: 'governance',
    title: 'France has fallen — how will you rule?',
    body: "With Henry IV defeated, the French throne is yours to claim. Your decision will shape your country's identity.",
    hint: 'Why: You are not just a general — you are a leader. The policies you set and the dilemmas you resolve define what your empire becomes.',
  },
  handoff: {
    beat: 'handoff',
    title: 'Your campaign begins',
    body: 'The tutorial is complete. Continue into the full Europe sandbox to pursue your chosen path to victory.',
    hint: 'New systems unlock as you play — including influence over foreign cities. Build influence through alliances, scouts, and diplomatic missions. Use it to pressure, extract from, or claim foreign cities. Watch the influence card on your Dashboard for opportunities.',
  },
};
