import type { IntelSource } from './types';

/**
 * Source attribution for intel UI. Returns null when only `direct` is present.
 * Shared by mobile IntelSourceHint and territory rows.
 */
export function formatIntelSourceLabel(sources: IntelSource[]): string | null {
  const attributed = sources.filter((source) => source !== 'direct');
  if (attributed.length === 0) return null;

  const labels: Record<IntelSource, string> = {
    direct: '',
    scout: 'via scouts',
    allied: 'via ally',
    treaty: 'per treaty',
    intelligence: 'via intelligence',
  };

  const text = attributed.map((source) => labels[source]).filter(Boolean).join(' · ');
  return text.length > 0 ? text : null;
}
