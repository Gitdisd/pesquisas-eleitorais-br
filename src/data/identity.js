/**
 * Single source of truth for poll identity.
 *
 * Publication/coverage dates are deliberately excluded from identity:
 * a later article about the same fieldwork wave is a witness/reprint, not a new poll.
 */
const INSTITUTE_ALIASES = new Map([
  ['genial/quaest', 'quaest'],
  ['quaest/genial', 'quaest'],
  ['btg/nexus', 'nexus'],
  ['nexus/btg', 'nexus'],
  ['cnt/mda', 'mda'],
  ['meio/ideia', 'ideia'],
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
  return INSTITUTE_ALIASES.get(raw) || raw;
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
  return normalizeProtocol(
    row?.tse_registration ??
    row?.tse_protocol ??
    row?.tseProtocol ??
    null,
  );
}

export function normalizeGeo(value) {
  const geo = String(value ?? 'BR').trim().toUpperCase();
  return geo || 'BR';
}

export function pollIdentityParts(row) {
  const scenario = normalizeIdentityText(row?.scenario);
  const geo = normalizeGeo(row?.geo);
  const protocol = tseProtocolOf(row);
  if (protocol) return ['tse', protocol, scenario, geo];
  return [
    'fallback',
    normalizeInstitute(row?.institute),
    String(row?.fieldwork_start ?? ''),
    String(row?.fieldwork_end ?? ''),
    scenario,
    geo,
  ];
}

export function canonicalPollKey(row) {
  return pollIdentityParts(row).join('|');
}

export function softPollKey(row) {
  return [
    'soft',
    normalizeInstitute(row?.institute),
    String(row?.fieldwork_end ?? ''),
    normalizeIdentityText(row?.scenario),
    normalizeGeo(row?.geo),
  ].join('|');
}

export function coverageDates(row) {
  const dates = new Set(
    Array.isArray(row?.coverage_dates)
      ? row.coverage_dates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d)))
      : [],
  );
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(row?.published_date ?? ''))) {
    dates.add(row.published_date);
  }
  return [...dates].sort();
}

export function identityDescription(row) {
  const protocol = tseProtocolOf(row);
  return protocol
    ? `${protocol} · ${normalizeIdentityText(row?.scenario)} · ${normalizeGeo(row?.geo)}`
    : `${normalizeInstitute(row?.institute)} · ${row?.fieldwork_start || '?'}–${row?.fieldwork_end || '?'} · ${normalizeIdentityText(row?.scenario)} · ${normalizeGeo(row?.geo)}`;
}
