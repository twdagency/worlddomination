import { terminal } from '../theme/terminal';

export type StanceTone = 'danger' | 'warning' | 'accent' | 'text' | 'muted';

export function stanceTone(stance: string): StanceTone {
  if (stance === 'Hostile') return 'danger';
  if (stance === 'Defensive') return 'warning';
  if (stance === 'Developing') return 'accent';
  if (stance === 'Active') return 'text';
  return 'muted';
}

export function stanceColor(stance: string): string {
  const tone = stanceTone(stance);
  switch (tone) {
    case 'danger':
      return terminal.danger;
    case 'warning':
      return terminal.warning;
    case 'accent':
      return terminal.accent;
    case 'text':
      return terminal.text;
    default:
      return terminal.muted;
  }
}

export function formatStanceDetail(stance: string): string {
  return `Posture (24h observed orders): ${stance}`;
}
