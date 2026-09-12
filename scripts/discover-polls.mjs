#!/usr/bin/env node
/**
 * Headless poll discovery for GitHub Actions (no human / no bot required).
 *
 * Flow:
 *  1. Load watermark = max published_date in data/polls.json
 *  2. Fetch curated URLs from data/sources.json
 *  3. Heuristic link scan for poll articles after watermark
 *  4. Fetch candidate pages; regex/JSON-LD extract when possible
 *  5. Merge verified:true records into data/polls.json (never invent numbers)
 *  6. Unparseable / PDF / hard pages → data/discovery/inbox.json
 *  7. Always bump meta last_check_at + check_interval_minutes 190
 *
 * Exit 0 on soft fetch failures (continue-on); exit 1 only on hard local I/O errors.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const POLLS_PATH = path.join(ROOT, "data", "polls.json");
const META_PATH = path.join(ROOT, "data", "meta.json");
const PUBLIC_META = path.join(ROOT, "public", "data", "meta.json");
const SOURCES_PATH = path.join(ROOT, "data", "sources.json");
const INBOX_PATH = path.join(ROOT, "data", "discovery", "inbox.json");
const REPORT_PATH = path.join(ROOT, "data", "discovery", "last-run.json");

const UA =
  "pesquisas-eleitorais-br-discover/1.0 (+https://github.com/Gitdisd/pesquisas-eleitorais-br; headless Actions)";
const FETCH_TIMEOUT_MS = 18_000;
const MAX_CANDIDATE_PAGES = 40;
const MAX_LINKS_PER_SOURCE = 30;

const CANDIDATE_CANON = [
  { keys: ["lula", "luiz inácio", "luiz inacio"], name: "Lula", party: "PT" },
  {
    keys: ["flávio bolsonaro", "flavio bolsonaro", "flávio", "flavio"],
    name: "Flávio Bolsonaro",
    party: "PL",
  },
  {
    keys: ["augusto cury", "cury"],
    name: "Augusto Cury",
    party: "Avante",
  },
  {
    keys: ["renan santos", "renan"],
    name: "Renan Santos",
    party: "Missão",
  },
  {
    keys: ["ronaldo caiado", "caiado"],
    name: "Ronaldo Caiado",
    party: "PSD",
  },
  {
    keys: ["romeu zema", "zema"],
    name: "Romeu Zema",
    party: "Novo",
  },
];

const INSTITUTE_PATTERNS = [
  { re: /\bdatafolha\b/i, name: "Datafolha" },
  { re: /\bgenial\s*\/?\s*quaest\b/i, name: "Genial/Quaest" },
  { re: /\bquaest\b/i, name: "Quaest" },
  { re: /\batlas\s*intel\b/i, name: "AtlasIntel" },
  { re: /\bpoder\s*data\b/i, name: "PoderData" },
  { re: /\bnexus\b.*\bbtg\b|\bbtg\b.*\bnexus\b|\bnexus\s*\/\s*btg\b/i, name: "Nexus/BTG" },
  { re: /\bparan[aá]\s*pesquisas\b/i, name: "Paraná Pesquisas" },
  { re: /\bideia\b/i, name: "Ideia" },
  { re: /\bcnt\b.*\bmda\b|\bmda\b.*\bcnt\b|\bcnt\s*\/\s*mda\b/i, name: "CNT/MDA" },
  { re: /\breal\s*time\s*big\s*data\b/i, name: "Real Time Big Data" },
  { re: /\bfutura\b/i, name: "Futura/Apex" },
  { re: /\bgerp\b/i, name: "GERP" },
  { re: /\bindexa\b/i, name: "Indexa/Broadcast" },
  { re: /\bvox\s*brasil\b|\bvox\b/i, name: "Vox Brasil" },
  { re: /\balfa\s*intelig[eê]ncia\b/i, name: "Alfa Inteligência" },
  { re: /\bpalver\b/i, name: "Palver" },
  { re: /\bverit[aá]\b/i, name: "Veritá" },
];

function parseArgs(argv) {
  const out = {
    dryRun: false,
    update: false,
    maxPages: MAX_CANDIDATE_PAGES,
  };
  for (const a of argv) {
    if (a === "--dry-run") out.dryRun = true;
    else if (a === "--update") out.update = true;
    else if (a.startsWith("--max-pages=")) {
      const n = Number(a.slice("--max-pages=".length));
      if (Number.isFinite(n) && n > 0) out.maxPages = Math.floor(n);
    }
  }
  return out;
}

function readJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (err) {
    if (fallback !== null) return fallback;
    throw err;
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function prettyPolls(polls) {
  return JSON.stringify(polls, null, 2) + "\n";
}

function unwrapPolls(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.polls)) return data.polls;
  throw new Error("polls.json must be a bare array or { polls: [...] }");
}

function watermarkFromPolls(polls) {
  let max = "1970-01-01";
  for (const p of polls) {
    if (typeof p.published_date === "string" && p.published_date > max) {
      max = p.published_date;
    }
  }
  return max;
}

function pollKey(p) {
  return [
    p.institute,
    p.fieldwork_start,
    p.fieldwork_end,
    p.published_date,
    p.scenario,
  ].join("|");
}

function pollSoftKey(p) {
  return [p.institute, p.fieldwork_end, p.scenario].join("|");
}

function scoreCandidateLink(link) {
  const hay = `${link.url || ""} ${link.title || ""}`.toLowerCase();
  let score = 0;
  if (/datafolha|quaest|atlasintel|poderdata|poder-data|nexus|ideia|futura|gerp|palver|verit|paran[aá]|indexa|vox|alfa/.test(hay))
    score += 50;
  if (/pesquisa-eleitoral|noticia\/20|eleicoes\/2026/.test(hay)) score += 25;
  if (/presidente|primeiro-turno|1o-turno|2o-turno/.test(hay)) score += 10;
  if (/news\.google|rss\/search|\/tag\/|\/feed\/?$|wikipedia\.org/.test(hay)) score -= 40;
  if (/\/politica\/?$|\/eleicoes\/?$/.test(hay)) score -= 15;
  return score;
}

function nowSaoPauloIso() {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(new Date()).map((p) => [p.type, p.value])
  );
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}:${parts.second}-03:00`;
}

function bumpMeta(polls, { contentChanged }) {
  const prev = readJson(META_PATH, {});
  const checkedAtUtc = new Date().toISOString();
  const meta = {
    schema_version: 1,
    last_updated:
      contentChanged || !prev.last_updated ? nowSaoPauloIso() : prev.last_updated,
    last_check_at: checkedAtUtc,
    check_interval_minutes: 190,
    record_count: polls.length,
    source: prev.source || "verified published polls",
    content_hash: prev.content_hash || "",
  };
  writeJson(META_PATH, meta);
  writeJson(PUBLIC_META, meta);
  return meta;
}

async function fetchText(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,application/xml,application/rss+xml,text/xml,*/*;q=0.8",
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
    });
    if (!res.ok) {
      return { ok: false, status: res.status, url, text: "", contentType: "" };
    }
    const contentType = res.headers.get("content-type") || "";
    const text = await res.text();
    return { ok: true, status: res.status, url: res.url || url, text, contentType };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      url,
      text: "",
      contentType: "",
      error: err.name === "AbortError" ? "timeout" : String(err.message || err),
    };
  } finally {
    clearTimeout(timer);
  }
}

function stripTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(href, base) {
  try {
    const u = new URL(href, base);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function looksLikePollLink(url, anchorText, keywords) {
  const hay = `${url} ${anchorText}`.toLowerCase();
  if (/\.pdf(\?|$)/i.test(url)) return true;
  if (/pesquisa|intenc|intenç|eleitoral|datafolha|quaest|poderdata|atlas|nexus|btg|gerp|ideia|vox|indexa|futura|cnt|mda|paran/i.test(hay)) {
    return true;
  }
  return keywords.some((k) => hay.includes(String(k).toLowerCase()));
}

function extractLinks(html, baseUrl, keywords) {
  const out = [];
  const seen = new Set();
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    const text = stripTags(m[2]).slice(0, 200);
    const abs = normalizeUrl(href, baseUrl);
    if (!abs || seen.has(abs)) continue;
    if (!looksLikePollLink(abs, text, keywords)) continue;
    seen.add(abs);
    out.push({ url: abs, title: text });
    if (out.length >= MAX_LINKS_PER_SOURCE) break;
  }
  // RSS / Atom
  const itemRe =
    /<item[\s\S]*?<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>[\s\S]*?(?:<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>)?[\s\S]*?<\/item>/gi;
  let rm;
  while ((rm = itemRe.exec(html)) !== null) {
    const abs = normalizeUrl(rm[1].trim(), baseUrl);
    const title = stripTags(rm[2] || "").slice(0, 200);
    if (!abs || seen.has(abs)) continue;
    if (!looksLikePollLink(abs, title, keywords)) continue;
    seen.add(abs);
    out.push({ url: abs, title });
    if (out.length >= MAX_LINKS_PER_SOURCE) break;
  }
  const entryRe =
    /<entry[\s\S]*?<link[^>]+href=["']([^"']+)["'][^>]*>[\s\S]*?(?:<title[^>]*>([\s\S]*?)<\/title>)?[\s\S]*?<\/entry>/gi;
  let em;
  while ((em = entryRe.exec(html)) !== null) {
    const abs = normalizeUrl(em[1].trim(), baseUrl);
    const title = stripTags(em[2] || "").slice(0, 200);
    if (!abs || seen.has(abs)) continue;
    if (!looksLikePollLink(abs, title, keywords)) continue;
    seen.add(abs);
    out.push({ url: abs, title });
    if (out.length >= MAX_LINKS_PER_SOURCE) break;
  }
  return out;
}

function detectInstitute(text) {
  for (const { re, name } of INSTITUTE_PATTERNS) {
    if (re.test(text)) return name;
  }
  return null;
}

function parseBrDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = s.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (br) {
    const d = br[1].padStart(2, "0");
    const m = br[2].padStart(2, "0");
    return `${br[3]}-${m}-${d}`;
  }
  const months = {
    janeiro: "01",
    fevereiro: "02",
    março: "03",
    marco: "03",
    abril: "04",
    maio: "05",
    junho: "06",
    julho: "07",
    agosto: "08",
    setembro: "09",
    outubro: "10",
    novembro: "11",
    dezembro: "12",
    jan: "01",
    fev: "02",
    mar: "03",
    abr: "04",
    mai: "05",
    jun: "06",
    jul: "07",
    ago: "08",
    set: "09",
    out: "10",
    nov: "11",
    dez: "12",
  };
  const named = s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/);
  if (named) {
    const key = named[2];
    const mm = months[key];
    if (mm) return `${named[3]}-${mm}-${named[1].padStart(2, "0")}`;
  }
  return null;
}

function extractJsonLd(html) {
  const blocks = [];
  const re =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      blocks.push(JSON.parse(m[1].trim()));
    } catch {
      /* ignore bad JSON-LD */
    }
  }
  return blocks;
}

function dateFromJsonLd(blocks) {
  for (const b of blocks) {
    const list = Array.isArray(b) ? b : [b];
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      for (const key of ["datePublished", "dateCreated", "uploadDate"]) {
        if (item[key]) {
          const d = parseBrDate(String(item[key]).slice(0, 32));
          if (d) return d;
        }
      }
    }
  }
  return null;
}

function extractFieldwork(text) {
  // "entre 4 e 7 de setembro de 2026" / "de 4 a 7 de setembro de 2026"
  const rangeNamed = text.match(
    /(?:entre|de)\s+(\d{1,2})\s+(?:e|a|até|ate)\s+(\d{1,2})\s+de\s+([A-Za-zçãáéíóúôõÇÃÁÉÍÓÚÔÕ]+)\s+de\s+(\d{4})/i
  );
  if (rangeNamed) {
    const endRaw = `${rangeNamed[2]} de ${rangeNamed[3]} de ${rangeNamed[4]}`;
    const end = parseBrDate(endRaw);
    if (end) {
      const start = `${end.slice(0, 8)}${rangeNamed[1].padStart(2, "0")}`;
      if (/^\d{4}-\d{2}-\d{2}$/.test(start)) return { start, end };
    }
  }
  const rangeIso = text.match(
    /(?:campo|fieldwork|coleta)[^\d]{0,40}(\d{4}-\d{2}-\d{2}).{0,20}(\d{4}-\d{2}-\d{2})/i
  );
  if (rangeIso) return { start: rangeIso[1], end: rangeIso[2] };
  const rangeBr = text.match(
    /(?:campo|coleta|realizad[ao])[^\d]{0,40}(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}).{0,20}(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4})/i
  );
  if (rangeBr) {
    const start = parseBrDate(rangeBr[1]);
    const end = parseBrDate(rangeBr[2]);
    if (start && end) return { start, end };
  }
  return null;
}

function extractN(text) {
  const m =
    text.match(
      /(?:amostra|entrevist(?:as|ados)|n\s*=)\s*(?:de\s*)?(\d{1,3}(?:[.\s]\d{3})+|\d{3,5})\b/i
    ) ||
    text.match(/\b(\d{1,3}(?:[.\s]\d{3})+|\d{4,5})\s*(?:entrevist|eleitores|pessoas)/i);
  if (!m) return null;
  const n = Number(String(m[1]).replace(/[.\s]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function extractMoe(text) {
  const m = text.match(
    /(?:margem(?:\s+de\s+erro)?|erro(?:\s+amostral)?)\s*(?:de|:)?\s*(?:±|\+\/-|mais\s*ou\s*menos)?\s*(\d+[.,]?\d*)\s*(?:pontos?(?:\s+percentuais)?|p\.?\s*p\.?|pp)?/i
  );
  if (!m) return null;
  const num = m[1].replace(",", ".");
  return `±${num} pp`;
}

function extractTse(text) {
  const m = text.match(/\bBR-?\d{4,5}\/?\d{4}\b/i);
  return m ? m[0].toUpperCase().replace(/^BR(\d)/, "BR-$1") : null;
}

function scoreNameMatch(fragment, keys) {
  const f = fragment
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "");
  for (const k of keys) {
    const kk = k
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{M}/gu, "");
    if (f.includes(kk)) return kk.length;
  }
  return 0;
}

function extractPctNearName(text, keys) {
  // "Lula 38%" / "Lula, com 38%" / "38% para Lula" / "Lula: 38"
  const patterns = [
    new RegExp(
      "(" +
        keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") +
        ")[^\\d%]{0,40}?(\\d{1,2}(?:[.,]\\d+)?)\\s*%",
      "i"
    ),
    new RegExp(
      "(\\d{1,2}(?:[.,]\\d+)?)\\s*%[^A-Za-zÁÉÍÓÚÂÊÔÃÕáéíóúâêôãõ]{0,20}(" +
        keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") +
        ")",
      "i"
    ),
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const numRaw = m[2] && /\d/.test(m[2]) ? m[2] : m[1];
    const pct = Number(String(numRaw).replace(",", "."));
    if (Number.isFinite(pct) && pct >= 0 && pct <= 100) return pct;
  }
  return null;
}

function extractCandidates(text) {
  const found = [];
  for (const c of CANDIDATE_CANON) {
    const pct = extractPctNearName(text, c.keys);
    if (pct == null) continue;
    found.push({ name: c.name, party_optional: c.party, pct });
  }
  return found;
}

function detectScenario(text) {
  const t = text.toLowerCase();
  const is2 =
    /2[ºo°]\s*turno|segundo\s+turno|2o\s*turno/.test(t) &&
    !/1[ºo°]\s*turno|primeiro\s+turno/.test(t.slice(0, Math.min(t.length, 500)));
  // Prefer explicit first-round if both appear heavily
  const has1 = /1[ºo°]\s*turno|primeiro\s+turno|estimulada/.test(t);
  const has2 = /2[ºo°]\s*turno|segundo\s+turno/.test(t);
  if (has1 && !has2) return "estimulada 1º turno";
  if (has2 && !has1) return "2º turno Lula x Flávio Bolsonaro";
  if (has1 && has2) {
    // Ambiguous page covering both — caller may split; mark as both-needed
    return "BOTH";
  }
  if (is2) return "2º turno Lula x Flávio Bolsonaro";
  return null;
}

function splitScenarioText(text) {
  // Try to isolate first vs second round sections for candidate extraction
  const lower = text.toLowerCase();
  const i1 = lower.search(/1[ºo°]\s*turno|primeiro\s+turno|estimulada/);
  const i2 = lower.search(/2[ºo°]\s*turno|segundo\s+turno/);
  if (i1 >= 0 && i2 >= 0) {
    if (i1 < i2) {
      return {
        first: text.slice(i1, i2),
        second: text.slice(i2),
      };
    }
    return {
      first: text.slice(i1),
      second: text.slice(i2, i1),
    };
  }
  return { first: text, second: text };
}

function buildPollRecord({
  institute,
  fieldwork,
  published,
  scenario,
  candidates,
  n,
  moe,
  sourceUrl,
  methodologyNote,
}) {
  // Completeness gate — never invent
  if (!institute || !fieldwork?.start || !fieldwork?.end || !published) return null;
  if (!scenario || scenario === "BOTH") return null;
  if (!Array.isArray(candidates) || candidates.length < 2) return null;
  if (typeof n !== "number" || !(n > 0)) return null;
  if (!moe) return null;

  // Round-specific candidate sanity
  if (scenario.startsWith("2º")) {
    const names = candidates.map((c) => c.name);
    if (!names.includes("Lula") || !names.includes("Flávio Bolsonaro")) return null;
    // Keep Lula, Flávio, and optional residual bucket only
    const keep = candidates.filter((c) =>
      ["Lula", "Flávio Bolsonaro"].includes(c.name)
    );
    const sum = keep.reduce((a, c) => a + c.pct, 0);
    if (false && sum > 0 && sum < 100) {
      keep.push({
        name: "branco/nulo/não sabe",
        party_optional: null,
        pct: Math.round((100 - sum) * 10) / 10,
      });
    }
    candidates = keep;
  } else {
    // Need at least Lula + Flávio for 1º
    const names = candidates.map((c) => c.name);
    if (!names.includes("Lula") || !names.includes("Flávio Bolsonaro")) return null;
    const sum = candidates.reduce((a, c) => a + c.pct, 0);
    if (false && sum > 0 && sum < 95) {
      candidates = [
        ...candidates,
        {
          name: "outros/branco/nulo/não sabe",
          party_optional: null,
          pct: Math.round((100 - sum) * 10) / 10,
        },
      ];
    }
  }

  return {
    institute,
    fieldwork_start: fieldwork.start,
    fieldwork_end: fieldwork.end,
    published_date: published,
    scenario,
    candidates,
    n,
    margin_of_error: moe,
    source_url: sourceUrl,
    methodology_note: methodologyNote || "",
    verified: true,
  };
}

function tryExtractPolls(html, pageUrl, watermark) {
  const text = stripTags(html);
  const jsonLd = extractJsonLd(html);
  const institute = detectInstitute(text);
  const published =
    dateFromJsonLd(jsonLd) ||
    parseBrDate(
      (text.match(
        /(?:publicad[ao]|divulgad[ao]|publicado em)\s*[:=]?\s*([^\s,]{1,40}(?:,?\s*de\s+[^\s,]{1,20}){0,3})/i
      ) || [])[1]
    ) ||
    parseBrDate(
      (pageUrl.match(/\/(20\d{2})\/(\d{2})\/(\d{2})\//) || []).slice(1).join("-")
    ) ||
    parseBrDate(
      (pageUrl.match(/\/(20\d{2})\/(\d{2})\//) || []).length
        ? null
        : null
    );

  // URL date fallback YYYY/MM/DD
  let publishedFinal = published;
  const urlDate = pageUrl.match(/\/(20\d{2})\/(\d{2})\/(\d{2})\//);
  if (!publishedFinal && urlDate) {
    publishedFinal = `${urlDate[1]}-${urlDate[2]}-${urlDate[3]}`;
  }

  const fieldwork = extractFieldwork(text);
  const n = extractN(text);
  const moe = extractMoe(text);
  const tse = extractTse(text);
  const scenario = detectScenario(text);

  const methodologyParts = [];
  if (tse) methodologyParts.push(`TSE ${tse}`);
  methodologyParts.push(`Auto-extracted from ${pageUrl}`);

  const reasonBits = [];
  if (!institute) reasonBits.push("no_institute");
  if (!publishedFinal) reasonBits.push("no_published_date");
  if (!fieldwork) reasonBits.push("no_fieldwork");
  if (!n) reasonBits.push("no_n");
  if (!moe) reasonBits.push("no_moe");
  if (!scenario) reasonBits.push("no_scenario");

  // Skip clearly old pages when we have a date
  if (publishedFinal && publishedFinal < watermark) {
    return {
      polls: [],
      inbox: null,
      skippedOld: true,
      published: publishedFinal,
    };
  }

  // PDFs: never invent OCR — inbox only
  if (/\.pdf(\?|$)/i.test(pageUrl) || /application\/pdf/i.test(html.slice(0, 20))) {
    return {
      polls: [],
      inbox: {
        url: pageUrl,
        title: institute ? `${institute} PDF` : "PDF poll source",
        reason: "pdf_needs_manual_or_ocr",
        institute,
        published_date: publishedFinal || null,
        found_at: new Date().toISOString(),
      },
      skippedOld: false,
    };
  }

  const polls = [];
  if (scenario === "BOTH") {
    const parts = splitScenarioText(text);
    const c1 = extractCandidates(parts.first);
    const c2 = extractCandidates(parts.second);
    const p1 = buildPollRecord({
      institute,
      fieldwork,
      published: publishedFinal,
      scenario: "estimulada 1º turno",
      candidates: c1,
      n,
      moe,
      sourceUrl: pageUrl,
      methodologyNote: methodologyParts.join("; "),
    });
    const p2 = buildPollRecord({
      institute,
      fieldwork,
      published: publishedFinal,
      scenario: "2º turno Lula x Flávio Bolsonaro",
      candidates: c2,
      n,
      moe,
      sourceUrl: pageUrl,
      methodologyNote: methodologyParts.join("; "),
    });
    if (p1) polls.push(p1);
    if (p2) polls.push(p2);
  } else if (scenario) {
    const candidates = extractCandidates(text);
    const p = buildPollRecord({
      institute,
      fieldwork,
      published: publishedFinal,
      scenario,
      candidates,
      n,
      moe,
      sourceUrl: pageUrl,
      methodologyNote: methodologyParts.join("; "),
    });
    if (p) polls.push(p);
  }

  if (polls.length > 0) {
    return { polls, inbox: null, skippedOld: false, published: publishedFinal };
  }

  // Not enough clean signal — inbox for human/Poll Research, do not invent
  const looksPollish =
    /pesquisa|intenção de voto|intencao de voto|estimulada|turno/i.test(text) ||
    institute;
  if (!looksPollish) {
    return { polls: [], inbox: null, skippedOld: false };
  }

  return {
    polls: [],
    inbox: {
      url: pageUrl,
      title: (stripTags(html).slice(0, 120) || pageUrl).slice(0, 120),
      reason: reasonBits.length
        ? `incomplete_extract:${reasonBits.join(",")}`
        : "numbers_not_clean",
      institute: institute || null,
      published_date: publishedFinal || null,
      found_at: new Date().toISOString(),
    },
    skippedOld: false,
  };
}

function stableSort(polls) {
  return [...polls].sort((a, b) => {
    if (a.fieldwork_end !== b.fieldwork_end)
      return a.fieldwork_end < b.fieldwork_end ? 1 : -1;
    if (a.published_date !== b.published_date)
      return a.published_date < b.published_date ? 1 : -1;
    if (a.institute !== b.institute) return a.institute < b.institute ? -1 : 1;
    if (a.scenario !== b.scenario) return a.scenario < b.scenario ? -1 : 1;
    return 0;
  });
}

function dedupeInbox(items) {
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const k = it.url || JSON.stringify(it);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(it);
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  console.log("[discover-polls] start", {
    dryRun: args.dryRun,
    update: args.update,
    maxPages: args.maxPages,
  });

  const sourcesDoc = readJson(SOURCES_PATH);
  const keywords = sourcesDoc.keywords || [];
  const sources = sourcesDoc.sources || [];
  const existing = unwrapPolls(readJson(POLLS_PATH));
  const watermark = watermarkFromPolls(existing);
  const existingKeys = new Set(existing.map(pollKey));
  const existingSoft = new Set(existing.map(pollSoftKey));
  const existingUrls = new Set(existing.map((p) => p.source_url));
  for (const extraPath of [path.join(ROOT, "data", "polls-extra.json"), path.join(ROOT, "public", "data", "polls-extra.json")]) {
    const extraDoc = readJson(extraPath, []);
    const extraList = Array.isArray(extraDoc) ? extraDoc : extraDoc.polls || [];
    for (const ep of extraList) {
      if (!ep || !ep.institute) continue;
      existingKeys.add(pollKey(ep));
      existingSoft.add(pollSoftKey(ep));
      if (ep.source_url) existingUrls.add(ep.source_url);
    }
  }

  console.log("[discover-polls] watermark published_date =", watermark);
  console.log("[discover-polls] existing polls =", existing.length);
  console.log("[discover-polls] sources =", sources.length);

  const fetchErrors = [];
  const seedLinks = [];
  const seenSeed = new Set();

  for (const src of sources) {
    for (const url of src.urls || []) {
      process.stdout.write(`[discover-polls] fetch source ${src.id}: ${url}\n`);
      const res = await fetchText(url);
      if (!res.ok) {
        fetchErrors.push({ source_id: src.id, url, status: res.status, error: res.error || null });
        console.warn("[discover-polls] soft fail", src.id, url, res.status, res.error || "");
        continue;
      }
      // Index page itself may be an article
      if (looksLikePollLink(res.url, src.name, keywords)) {
        if (!seenSeed.has(res.url)) {
          seenSeed.add(res.url);
          seedLinks.push({
            url: res.url,
            title: src.name,
            source_id: src.id,
          });
        }
      }
      const links = extractLinks(res.text, res.url, keywords);
      for (const link of links) {
        if (seenSeed.has(link.url)) continue;
        seenSeed.add(link.url);
        seedLinks.push({ ...link, source_id: src.id });
      }
    }
  }

  console.log("[discover-polls] candidate links =", seedLinks.length);

  // Prefer links not already in dataset; cap pages fetched
  const toFetch = seedLinks
    .filter((l) => !existingUrls.has(l.url))
    .sort((a, b) => scoreCandidateLink(b) - scoreCandidateLink(a))
    .slice(0, args.maxPages);

  const verifiedNew = [];
  const inboxNew = [];
  let skippedOld = 0;
  let pagesFetched = 0;

  for (const link of toFetch) {
    pagesFetched += 1;
    process.stdout.write(`[discover-polls] fetch page ${pagesFetched}/${toFetch.length}: ${link.url}\n`);
    const res = await fetchText(link.url);
    if (!res.ok) {
      fetchErrors.push({
        source_id: link.source_id,
        url: link.url,
        status: res.status,
        error: res.error || null,
      });
      inboxNew.push({
        url: link.url,
        title: link.title || "",
        reason: `fetch_failed:${res.status || res.error || "error"}`,
        institute: null,
        published_date: null,
        found_at: new Date().toISOString(),
      });
      continue;
    }
    const extracted = tryExtractPolls(res.text, res.url, watermark);
    if (extracted.skippedOld) {
      skippedOld += 1;
      continue;
    }
    for (const p of extracted.polls) {
      if (existingKeys.has(pollKey(p)) || existingSoft.has(pollSoftKey(p))) continue;
      verifiedNew.push(p);
      existingKeys.add(pollKey(p));
      existingSoft.add(pollSoftKey(p));
    }
    if (extracted.inbox) inboxNew.push(extracted.inbox);
  }

  console.log("[discover-polls] verified new =", verifiedNew.length);
  console.log("[discover-polls] inbox new =", inboxNew.length);
  console.log("[discover-polls] skipped old =", skippedOld);
  console.log("[discover-polls] fetch errors =", fetchErrors.length);

  const prevInbox = readJson(INBOX_PATH, { version: 1, items: [] });
  const inboxItems = dedupeInbox([
    ...(Array.isArray(prevInbox.items) ? prevInbox.items : []),
    ...inboxNew,
  ]).slice(0, 200);

  const merged = stableSort([...verifiedNew, ...existing]);
  const contentChanged = verifiedNew.length > 0;

  const report = {
    ran_at: new Date().toISOString(),
    watermark,
    sources: sources.length,
    candidate_links: seedLinks.length,
    pages_fetched: pagesFetched,
    verified_new: verifiedNew.length,
    inbox_new: inboxNew.length,
    skipped_old: skippedOld,
    fetch_errors: fetchErrors.length,
    dry_run: args.dryRun,
    verified_samples: verifiedNew.slice(0, 5).map((p) => ({
      institute: p.institute,
      published_date: p.published_date,
      scenario: p.scenario,
      source_url: p.source_url,
    })),
    inbox_samples: inboxNew.slice(0, 5),
  };

  if (args.dryRun) {
    console.log("[discover-polls] DRY RUN — not writing polls/meta/inbox");
    console.log(JSON.stringify(report, null, 2));
    // Still allow inspecting report path optionally
    writeJson(REPORT_PATH, report);
    return;
  }

  if (contentChanged) {
    fs.writeFileSync(POLLS_PATH, prettyPolls(merged), "utf8");
    console.log("[discover-polls] wrote data/polls.json (+%d)", verifiedNew.length);
  } else {
    console.log("[discover-polls] no verified new polls to merge");
  }

  writeJson(INBOX_PATH, {
    version: 1,
    updated_at: new Date().toISOString(),
    items: inboxItems,
  });

  const meta = bumpMeta(contentChanged ? merged : existing, { contentChanged });
  writeJson(REPORT_PATH, { ...report, meta_last_check_at: meta.last_check_at });

  console.log("[discover-polls] meta last_check_at =", meta.last_check_at);
  console.log("[discover-polls] check_interval_minutes =", meta.check_interval_minutes);
  console.log("[discover-polls] inbox size =", inboxItems.length);

  if (args.update || process.env.DISCOVER_CALL_UPDATE === "1") {
    console.log("[discover-polls] invoking update-polls…");
    const { spawnSync } = await import("child_process");
    const r = spawnSync(process.execPath, [path.join(__dirname, "update-polls.mjs")], {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    });
    if (r.status !== 0) {
      console.error("[discover-polls] update-polls exited", r.status);
      process.exit(r.status || 1);
    }
  }

  console.log("[discover-polls] done");
}

main().catch((err) => {
  console.error("[discover-polls] hard failure:", err);
  process.exit(1);
});
