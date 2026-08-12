import { Sticker } from './types';

export interface Chapter {
  key: string;
  title: string;
  subtitle: string;
  stickers: Sticker[];
  coverSticker: Sticker;
}

const MAX_GAP_HOURS = 24;
const MAX_DISTANCE_KM = 5;
const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineKm(a: Sticker, b: Sticker): number {
  const dLat = toRad((b.latitude as number) - (a.latitude as number));
  const dLon = toRad((b.longitude as number) - (a.longitude as number));
  const lat1 = toRad(a.latitude as number);
  const lat2 = toRad(b.latitude as number);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

const MONTH_DAY = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const MONTH_ONLY = new Intl.DateTimeFormat('en-US', { month: 'short' });

// Uses local-time getters (no explicit timeZone) so dates render in the
// device's current timezone — a known simplification for cross-timezone travel.
function formatDateRange(start: Date, end: Date): string {
  const sameDay = start.toDateString() === end.toDateString();
  if (sameDay) return MONTH_DAY.format(start);

  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) {
    return `${MONTH_ONLY.format(start)} ${start.getDate()} – ${end.getDate()}`;
  }

  return `${MONTH_DAY.format(start)} – ${MONTH_DAY.format(end)}`;
}

/**
 * Groups stickers into scrapbook-style "chapters" by when and (if available)
 * where they were discovered. A new chapter starts when stickers are more
 * than 24h apart, or more than 5km apart (when both have location data).
 * Returns chapters newest-first; each chapter's stickers are newest-first.
 */
export function buildChapters(stickers: Sticker[]): Chapter[] {
  if (stickers.length === 0) return [];

  const sorted = [...stickers].sort(
    (a, b) => new Date(a.discovered_at).getTime() - new Date(b.discovered_at).getTime()
  );

  const groups: Sticker[][] = [];
  let currentGroup: Sticker[] = [sorted[0]];
  let anchor = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const curr = sorted[i];
    const prev = sorted[i - 1];

    const gapHours = (new Date(curr.discovered_at).getTime() - new Date(prev.discovered_at).getTime()) / 3_600_000;
    const tooFarInTime = gapHours > MAX_GAP_HOURS;

    const bothHaveLocation = anchor.latitude != null && anchor.longitude != null
      && curr.latitude != null && curr.longitude != null;
    const tooFarInSpace = bothHaveLocation && haversineKm(anchor, curr) > MAX_DISTANCE_KM;

    if (tooFarInTime || tooFarInSpace) {
      groups.push(currentGroup);
      currentGroup = [curr];
      anchor = curr;
    } else {
      currentGroup.push(curr);
    }
  }
  groups.push(currentGroup);

  const chapters: Chapter[] = groups.map((group) => {
    const newestFirst = [...group].reverse();
    const coverSticker = newestFirst[0];
    const start = new Date(group[0].discovered_at);
    const end = new Date(group[group.length - 1].discovered_at);
    const dateRange = formatDateRange(start, end);

    const labelCounts = new Map<string, number>();
    for (const sticker of group) {
      if (sticker.location_label) {
        labelCounts.set(sticker.location_label, (labelCounts.get(sticker.location_label) ?? 0) + 1);
      }
    }

    let title: string;
    if (labelCounts.size > 0) {
      let bestLabel = coverSticker.location_label ?? '';
      let bestCount = -1;
      for (const [label, count] of labelCounts) {
        if (count > bestCount) {
          bestCount = count;
          bestLabel = label;
        }
      }
      // Tie-break in favor of the cover sticker's own label.
      if (coverSticker.location_label && labelCounts.get(coverSticker.location_label) === bestCount) {
        bestLabel = coverSticker.location_label;
      }
      title = bestLabel;
    } else {
      title = dateRange;
    }

    const subtitle = labelCounts.size > 0
      ? dateRange
      : `${group.length} sticker${group.length === 1 ? '' : 's'}`;

    return {
      key: coverSticker.id,
      title,
      subtitle,
      stickers: newestFirst,
      coverSticker,
    };
  });

  return chapters.reverse();
}
