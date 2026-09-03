import type { TutorialBeatId } from 'sim/types';

export interface BeatCopy {
  beat: TutorialBeatId;
  title: string;
  /** Scene-setting line shown before the main instruction. */
  intro?: string;
  body: string;
  hint?: string;
}

/** Landing-menu copy for the guided tutorial path. */
export const TUTORIAL_SCENE_COPY = {
  landingHint:
    'London, 1603 — march on Paris, learn combat and economy, then graduate to the full campaign.',
  optionsBlurb:
    'Tutorial time runs at 30× with instant player actions. Full campaigns run at real-time 1×.',
} as const;

export const TUTORIAL_BEAT_COPY: Record<TutorialBeatId, BeatCopy> = {
  movement: {
    beat: 'movement',
    title: 'Send your forces to Paris',
    intro:
      'Your Channel garrison holds London while French troops dig in at Paris. The first move sets the tone.',
    body: 'Open Order and dispatch your London stack toward Paris. Tutorial marches resolve in seconds so you learn the loop without waiting.',
    hint: 'Why: Every action takes time in a live campaign. The tutorial compresses that wait so you can focus on decisions.',
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
  influence: {
    beat: 'influence',
    title: 'Sway a foreign city',
    body: 'Open Order and start a Diplomatic Mission in a Burgundian city. Influence is the non-military path — one deliberate action per day. Intelligence is separate and can run the same day.',
    hint: 'Why: Armies take cities. Influence takes them without a fight — pressure, tribute, coup, and defection all require sway you build over time.',
  },
  handoff: {
    beat: 'handoff',
    title: 'Your campaign begins',
    body: 'The tutorial is complete. Continue into the full Europe sandbox to pursue your chosen path to victory.',
    hint: 'Keep using the Dashboard influence card. Build sway, then pressure, extract from, or claim foreign cities.',
  },
};
