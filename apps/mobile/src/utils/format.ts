const MS_PER_MINUTE = 60_000;

export function formatDuration(ms: number): string {
  if (ms <= 0) return '0m';
  const totalMinutes = Math.ceil(ms / MS_PER_MINUTE);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}m`);
  return parts.join(' ');
}

export function formatAwayDuration(ms: number): string {
  if (ms < MS_PER_MINUTE) return '< 1m';
  return formatDuration(ms);
}

export function formatDateTime(epochMs: number): string {
  return new Date(epochMs).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const SHORT_MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;

/** Locale-stable calendar label — en-GB `toLocaleString` uses "Sept" and overflows the header. */
export function formatGameClockDate(epochMs: number): string {
  const date = new Date(epochMs);
  return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`;
}

/** 24-hour clock so AM/PM never steals header space. */
export function formatGameClockTime(epochMs: number): string {
  const date = new Date(epochMs);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** Compact game-clock label for the persistent header (no weekday). */
export function formatGameClock(epochMs: number): string {
  return `${formatGameClockDate(epochMs)} · ${formatGameClockTime(epochMs)}`;
}

export function formatFunding(amount: number): string {
  return `$${Math.floor(amount).toLocaleString()}`;
}

export function formatRate(amount: number, suffix: string): string {
  return `${Math.round(amount).toLocaleString()}${suffix}`;
}

export function formatResource(amount: number): string {
  return Math.floor(amount).toLocaleString();
}

export function formatSpeed(kmh: number): string {
  return `${kmh.toFixed(1)} km/h`;
}

export function formatDistance(km: number): string {
  return `${Math.round(km).toLocaleString()} km`;
}
