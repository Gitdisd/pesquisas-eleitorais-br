/**
 * Single source of truth for poll identity.
 * Publication/coverage dates are coverage metadata, never canonical identity.
 */

const INSTITUTE_ALIASES = new Map([
  ['genial/quaest', 'quaest'],
  ['quaest/genial', 'quaest'],
  ['btg/nexus', 'nexus'],
  ['nexus/btg', 'nexus'],
  ['cnt/mda', 'mda'],
  ['mda/cnt', 'mda'],
  ['meio/ideia', 'ideia'],
  ['ideia/meio', 'ideia'],
  ['poderdata/aya', 'poderdata'],
  ['poder data/aya', 'poderdata'],
]);

export function normalizeIdentityText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function normalizeInstitute(value) {
  const raw = normalizeIdentityText(value).replace(/\s*\/\s*/g, '/');
  if (INSTITUTE_ALIASES.has(raw)) return INSTITUTE_ALIASES.get(raw);
  if (raw.includes('datafolha')) return 'datafolha';
  return raw;
}

export function normalizeProtocol(value) {
  const raw = String(value ?? '')
    .replace(/[\u00a0]/g, ' ')
    .replace(/[–—−]/g, '-')
    .trim();
  const patterns = [
    /\bBR\s*-?\s*(\d{4,6})\s*\/\s*(\d{4})\b/i,
    /\bBR\s*-?\s*(\d{4,6})\s+(\d{4})\b/i,
    /\bBR\s*-?\s*(\d{4,6})(\d{4})\b/i,
  ];
  for (const re of patterns) {
    const match = raw.match(re);
    if (match && match[2] === '2026') return `BR-${match[1]}/2026`;
  }
  return null;
}

export function tseProtocolOf(row) {
  for (const value of [row?.tse_registration, row?.tse_protocol, row?.tseProtocol, row?.tse]) {
    const protocol = normalizeProtocol(value)
    if (protocol) return protocol
  }
  const note = String(row?.methodology_note || '')
    .replace(/\b(?:distinct from|not the|diferente de|separate (?:product|wave) from)[^.]*\./gi, ' ')
  const found = new Set()
  for (const match of note.matchAll(/\bBR\s*-?\s*\\d{4,6}\s*(?:\/\s*2026|\s+2026|2026)\\b/gi)) {
    const protocol = normalizeProtocol(match[0])
    if (protocol) found.add(protocol)
  }
  return found.size === 1 ? [...found][0] : null
}

export function normalizeGeo(value) {
  const geo = String(value ?? 'BR').trim().toUpperCase();
  return geo || 'BR';
}

export function fallbackPollKey(row) {
  return [
    'fallback',
    normalizeInstitute(row?.institute),
    String(row?.fieldwork_start ?? ''),
    String(row?.fieldwork_end ?? ''),
    normalizeIdentityText(row?.scenario),
    normalizeGeo(row?.geo),
  ].join('|');
}

export function canonicalPollKey(row) {
  const protocol = tseProtocolOf(row);
  const scenario = normalizeIdentityText(row?.scenario);
  const geo = normalizeGeo(row?.geo);
  if (protocol) return ['tse', protocol, scenario, geo].join('|');
  return fallbackPollKey(row);
}

export function identityMatchKeys(row) {
  return [...new Set([canonicalPollKey(row), fallbackPollKey(row)])];
}

export function coverageDates(row) {
  const dates = new Set(
    Array.isArray(row?.coverage_dates)
      ? row.coverage_dates
          .map((d) => String(d))
          .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
      : [],
  );
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(row?.published_date ?? ''))) {
    dates.add(String(row.published_date));
  }
  return [...dates].sort();
}

export function identityDescription(row) {
  const protocol = tseProtocolOf(row);
  return protocol
    ? `${protocol} · ${normalizeIdentityText(row?.scenario)} · ${normalizeGeo(row?.geo)}`
    : `${normalizeInstitute(row?.institute)} · ${row?.fieldwork_start || '?'}–${row?.fieldwork_end || '?'} · ${normalizeIdentityText(row?.scenario)} · ${normalizeGeo(row?.geo)}`;
}
