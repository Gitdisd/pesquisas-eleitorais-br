#!/usr/bin/env node
/**
 * Registry-backed recovery and integrity pipeline.
 *
 * This is deliberately separate from the broad heuristic discovery pass.
 * The broad pass finds articles; this pass asks a more important question:
 * "What polls does the TSE say exist, and can we account for each one?"
 *
 * Stages:
 *  1. Download the official TSE 2026 poll registry export.
 *  2. Keep national presidential registrations in a normalized inventory.
 *  3. Match inventory entries against polls already stored in the dataset.
 *  4. For unmatched registrations, search Google News RSS using the TSE protocol.
 *  5. Fetch candidate evidence pages and extract metadata + ALL tracked candidates.
 *  6. Accept a poll only when the evidence is internally coherent and the
 *     protocol/metadata is strong enough; conflicting evidence is quarantined.
 *  7. Emit stable reports for "missing", "conflict", and "coverage" states.
 *
 * Never invents a percentage. Missing values remain missing; an explicit 0 is
 * retained only when a source actually reports 0.
 */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import readline from "node:readline";
import { execFileSync } from "node:child_process";
import { canonicalPollKey, normalizeProtocol } from "../src/data/identity.js";

const ROOT = process.cwd();
const CFG_PATH = path.join(ROOT, "data", "discovery", "pipeline-config.json");
const POLLS_PATH = path.join(ROOT, "data", "polls.json");
const REGISTRY_PATH = path.join(ROOT, "data", "discovery", "tse-registry.json");
const STATUS_PATH = path.join(ROOT, "data", "discovery", "coverage-status.json");
const CONFLICTS_PATH = path.join(ROOT, "data", "discovery", "conflicts.json");
const MISSING_PATH = path.join(ROOT, "data", "discovery", "missing-registered.json");
const UA = "pesquisas-eleitorais-br-pipeline/1.0 (+https://github.com/Gitdisd/pesquisas-eleitorais-br)";

const cfg = JSON.parse(fs.readFileSync(CFG_PATH, "utf8"));
const candidateAliases = cfg.candidate_aliases || [];
const trustedHosts = new Set(cfg.trusted_evidence_hosts || []);

function writeJsonStable(file, value) {
  const out = `${JSON.stringify(value, null, 2)}\n`;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const previous = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (previous !== out) fs.writeFileSync(file, out, "utf8");
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

function cleanSpace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function parseDate(value) {
  const s = cleanSpace(value);
  if (!s) return null;
  const iso = s.match(/^(\d{4})[-/](\d{2})[-/](\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = s.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})/);
  if (br) return `${br[3]}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  const named = normalizeText(s).match(/(\d{1,2})\s+de\s+([a-z]+)\s+de\s+(\d{4})/);
  if (named) {
    const months = {
      janeiro: "01", fevereiro: "02", marco: "03", abril: "04", maio: "05", junho: "06",
      julho: "07", agosto: "08", setembro: "09", outubro: "10", novembro: "11", dezembro: "12"
    };
    if (months[named[2]]) return `${named[3]}-${months[named[2]]}-${named[1].padStart(2, "0")}`;
  }
  return null;
}

function unwrapPolls(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.polls)) return data.polls;
  return [];
}

function pollProtocols(poll) {
  const joined = [poll.methodology_note, poll.source_url, poll.tse_registration].filter(Boolean).join(" ");
  return [...joined.matchAll(/\bBR-?\d{4,6}\/2026\b/gi)].map((m) => m[0].toUpperCase().replace(/^BR(?=\d)/, "BR-"));
}

function canonicalUrl(url) {
  try {
    const u = new URL(url);
    u.hash = "";
    for (const k of [...u.searchParams.keys()]) {
      if (/utm_|ref|source|fbclid|gclid/i.test(k)) u.searchParams.delete(k);
    }
    return u.toString().replace(/\/$/, "");
  } catch {
    return String(url || "");
  }
}

async function fetchText(url, timeoutMs = cfg.request_timeout_ms || 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml,application/xml,application/rss+xml,text/xml,*/*;q=0.8",
        "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
      },
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, url: res.url || url, text, contentType: res.headers.get("content-type") || "" };
  } catch (error) {
    return { ok: false, status: 0, url, text: "", contentType: "", error: error.name === "AbortError" ? "timeout" : String(error.message || error) };
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBuffer(url, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { redirect: "follow", signal: controller.signal, headers: { "user-agent": UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } finally {
    clearTimeout(timer);
  }
}

function parseCsvLine(line, delimiter = ";") {
  const out = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      out.push(cell); cell = "";
    } else {
      cell += ch;
    }
  }
  out.push(cell);
  return out;
}

function detectDelimiter(line) {
  const semis = (line.match(/;/g) || []).length;
  const commas = (line.match(/,/g) || []).length;
  return semis >= commas ? ";" : ",";
}

function field(headers, patterns) {
  for (const header of headers) {
    const n = normalizeText(header).replace(/[^a-z0-9]+/g, "_");
    if (patterns.some((re) => re.test(n))) return header;
  }
  return null;
}

function firstDate(row, headers, patterns) {
  const h = field(headers, patterns);
  return h ? parseDate(row[h]) : null;
}

function firstNumber(row, headers, patterns) {
  const h = field(headers, patterns);
  if (!h) return null;
  const m = String(row[h] || "").replace(/\./g, "").replace(",", ".").match(/\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

async function loadTseRegistry() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tse-polls-"));
  const zipPath = path.join(tmpDir, "pesquisa_eleitoral_2026.zip");
  const csvPath = path.join(tmpDir, "selected.csv");
  try {
    const buffer = await fetchBuffer(cfg.tse_registry_zip, 45000);
    fs.writeFileSync(zipPath, buffer);

    const files = execFileSync("unzip", ["-Z1", zipPath], { encoding: "utf8" })
      .split(/\r?\n/)
      .filter((x) => /\.(csv|CSV)$/.test(x));
    let selected = null;
    for (const file of files) {
      try {
        const head = execFileSync("bash", ["-lc", `unzip -p ${JSON.stringify(zipPath)} ${JSON.stringify(file)} | head -n 1`], { encoding: "utf8", maxBuffer: 1024 * 1024 });
        const norm = normalizeText(head);
        if (/pesquisa|registro|eleitoral/.test(norm) && /(nr|num|cod).*pesquisa|pesquisa.*(nr|num|cod)/.test(norm)) {
          selected = file;
          break;
        }
      } catch {
        /* try the next CSV */
      }
    }
    if (!selected) {
      selected = files.find((x) => normalizeText(x).includes("pesquisa")) || files[0];
    }
    if (!selected) throw new Error("No CSV file found in TSE registry ZIP");

    execFileSync("bash", ["-lc", `unzip -p ${JSON.stringify(zipPath)} ${JSON.stringify(selected)} > ${JSON.stringify(csvPath)}`], { stdio: "inherit" });

    const rl = readline.createInterface({ input: fs.createReadStream(csvPath, { encoding: "utf8" }), crlfDelay: Infinity });
    let headers = null;
    let delimiter = ";";
    const records = [];
    for await (const lineRaw of rl) {
      const line = lineRaw.replace(/^\ufeff/, "");
      if (!headers) {
        delimiter = detectDelimiter(line);
        headers = parseCsvLine(line, delimiter).map(cleanSpace);
        continue;
      }
      if (!line.trim()) continue;
      const cells = parseCsvLine(line, delimiter);
      if (cells.length < 2) continue;
      const row = Object.fromEntries(headers.map((h, i) => [h, cleanSpace(cells[i] || "")]));
      const all = normalizeText(Object.values(row).join(" | "));
      const protocol = normalizeProtocol(Object.values(row).join(" "));
      if (!protocol) continue;
      if (!/(presidente|presidencia|presidencial)/i.test(all)) continue;
      if (!/(brasil|nacional)/i.test(all)) {
        // Presidential registrations are national; this also rejects stray local office records
        // that happen to carry the word "presidente" in notes.
        continue;
      }
      const instituteField = field(headers, [/entidade/, /empresa/, /instituto/, /responsavel/]);
      const regDate = firstDate(row, headers, [/data.*registro/, /dt.*registro/, /registro.*data/]);
      const publishDate = firstDate(row, headers, [/divulg/, /publica/, /previs.*divulg/]);
      const fieldStart = firstDate(row, headers, [/inicio.*coleta/, /inicio.*campo/, /data.*inicio/, /coleta.*inicio/]);
      const fieldEnd = firstDate(row, headers, [/fim.*coleta/, /fim.*campo/, /data.*fim/, /coleta.*fim/]);
      const sampleN = firstNumber(row, headers, [/amostra/, /entrevist/, /n.*entrevist/]);
      const scopeField = field(headers, [/abrang/, /uf/, /federativa/]);
      records.push({
        protocol,
        institute: instituteField ? row[instituteField] || null : null,
        registered_date: regDate,
        planned_publication_date: publishDate,
        fieldwork_start: fieldStart,
        fieldwork_end: fieldEnd,
        sample_n: sampleN,
        scope: scopeField ? row[scopeField] || null : null,
        raw_fingerprint: sha256(JSON.stringify(row)),
      });
    }

    records.sort((a, b) => String(a.protocol).localeCompare(String(b.protocol)) || String(a.registered_date).localeCompare(String(b.registered_date)));
    return { source_file: selected, records, generated_sha256: sha256(JSON.stringify(records)) };
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function jsonLd(html) {
  const blocks = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { blocks.push(JSON.parse(m[1].trim())); } catch { /* ignore */ }
  }
  return blocks;
}

function dateFromJsonLd(html) {
  for (const block of jsonLd(html)) {
    const list = Array.isArray(block) ? block : [block];
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      for (const key of ["datePublished", "dateCreated", "uploadDate"]) {
        const d = parseDate(item[key]);
        if (d) return d;
      }
    }
  }
  return null;
}

function extractFieldwork(text) {
  const named = text.match(/(?:entre|de)\s+(\d{1,2})\s+(?:e|a|até|ate)\s+(\d{1,2})\s+de\s+([A-Za-zÀ-ÿ]+)\s+de\s+(\d{4})/i);
  if (named) {
    const end = parseDate(`${named[2]} de ${named[3]} de ${named[4]}`);
    if (end) return { start: `${end.slice(0, 8)}${named[1].padStart(2, "0")}`, end };
  }
  const iso = text.match(/(?:campo|coleta|fieldwork)[^\d]{0,60}(\d{4}-\d{2}-\d{2}).{0,30}(\d{4}-\d{2}-\d{2})/i);
  if (iso) return { start: iso[1], end: iso[2] };
  const br = text.match(/(?:campo|coleta|realizad[ao])[^\d]{0,60}(\d{1,2}[/. -]\d{1,2}[/. -]\d{4}).{0,30}(\d{1,2}[/. -]\d{1,2}[/. -]\d{4})/i);
  if (br) return { start: parseDate(br[1]), end: parseDate(br[2]) };
  return null;
}

function extractN(text) {
  const m = text.match(/(?:amostra|entrevist(?:as|ados)|n\s*=)[^\d]{0,20}(\d{1,3}(?:[.\s]\d{3})+|\d{3,5})\b/i) || text.match(/\b(\d{4,5})\s+(?:entrevist|eleitores|pessoas)\b/i);
  if (!m) return null;
  const n = Number(String(m[1]).replace(/[.\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function extractMoe(text) {
  const m = text.match(/(?:margem(?:\s+de\s+erro)?|erro(?:\s+amostral)?)[^\d]{0,15}(?:±|\+\/-)?\s*(\d+(?:[.,]\d+)?)\s*(?:pontos?(?:\s+percentuais)?|pp)?/i);
  return m ? `±${m[1].replace(",", ".")} pp` : null;
}

function extractProtocol(text) {
  return text.match(/\bBR-?\d{4,6}\/2026\b/i)?.[0]?.toUpperCase().replace(/^BR(?=\d)/, "BR-") || null;
}

function escRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function aliasesFor(candidate) {
  return candidate.aliases || [candidate.name];
}

function pctNearName(text, aliases) {
  for (const alias of aliases) {
    const a = escRe(alias);
    const patterns = [
      new RegExp(`(?:^|[^A-Za-zÀ-ÿ])${a}[^\\d%]{0,70}(\\d{1,2}(?:[.,]\\d+)?)\\s*%`, "i"),
      new RegExp(`(\\d{1,2}(?:[.,]\\d+)?)\\s*%[^A-Za-zÀ-ÿ]{0,20}${a}(?:$|[^A-Za-zÀ-ÿ])`, "i"),
    ];
    for (const re of patterns) {
      const m = text.match(re);
      if (!m) continue;
      const n = Number(m[1].replace(",", "."));
      if (Number.isFinite(n) && n >= 0 && n <= 100) return n;
    }
  }
  return null;
}

function extractTables(html) {
  const rows = [];
  for (const table of html.matchAll(/<table\b[\s\S]*?<\/table>/gi)) {
    for (const row of table[0].matchAll(/<tr\b[\s\S]*?<\/tr>/gi)) {
      const cells = [...row[0].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => cleanSpace(stripHtml(m[1])));
      if (cells.length >= 2) rows.push(cells);
    }
  }
  return rows;
}

function extractCandidates(html, text) {
  const values = new Map();
  for (const row of extractTables(html)) {
    for (const candidate of candidateAliases) {
      const idx = row.findIndex((cell) => aliasesFor(candidate).some((a) => normalizeText(cell).includes(normalizeText(a))));
      if (idx < 0) continue;
      const candidatesNearby = row.slice(Math.max(0, idx - 1), Math.min(row.length, idx + 4)).join(" ");
      const valueMatch = candidatesNearby.match(/(\d{1,2}(?:[.,]\d+)?)\s*%/);
      if (!valueMatch) continue;
      const pct = Number(valueMatch[1].replace(",", "."));
      if (Number.isFinite(pct) && pct >= 0 && pct <= 100) values.set(candidate.name, { name: candidate.name, party_optional: candidate.party, pct, confidence: 0.98, method: "table" });
    }
  }
  for (const candidate of candidateAliases) {
    if (values.has(candidate.name)) continue;
    const pct = pctNearName(text, aliasesFor(candidate));
    if (pct == null) continue;
    values.set(candidate.name, { name: candidate.name, party_optional: candidate.party, pct, confidence: 0.75, method: "text" });
  }
  return [...values.values()];
}

function scenarioParts(text) {
  const lower = normalizeText(text);
  const first = lower.search(/1o?\s*turno|primeiro\s+turno|estimulada/);
  const second = lower.search(/2o?\s*turno|segundo\s+turno/);
  if (first >= 0 && second >= 0 && first !== second) {
    if (first < second) return { first: text.slice(first, second), second: text.slice(second) };
    return { first: text.slice(first), second: text.slice(second, first) };
  }
  if (second >= 0) return { first: "", second: text.slice(second) };
  return { first: text, second: "" };
}

function detectInstitute(text) {
  const patterns = [
    [/\bDatafolha\b/i, "Datafolha"], [/\bGenial\s*\/?\s*Quaest\b/i, "Genial/Quaest"], [/\bQuaest\b/i, "Quaest"],
    [/\bAtlas\s*Intel\b/i, "AtlasIntel"], [/\bPoder\s*Data\b/i, "PoderData"], [/\bNexus\b.*\bBTG\b|\bBTG\b.*\bNexus\b/i, "Nexus/BTG"],
    [/\bParan[aá]\s*Pesquisas\b/i, "Paraná Pesquisas"], [/\bMeio\/?\s*Ideia\b|\bIdeia\b/i, "Ideia"], [/\bCNT\b.*\bMDA\b|\bMDA\b.*\bCNT\b/i, "CNT/MDA"],
    [/\bReal\s*Time\s*Big\s*Data\b/i, "Real Time Big Data"], [/\bFutura\b/i, "Futura/Apex"], [/\bGERP\b/i, "GERP"],
    [/\bIndexa\b/i, "Indexa/Broadcast"], [/\bVox\s*Brasil\b|\bVox\b/i, "Vox Brasil"], [/\bAlfa\s*Intelig[eê]ncia\b/i, "Alfa Inteligência"],
    [/\bPalver\b/i, "Palver"], [/\bVerit[aá]\b/i, "Veritá"],
  ];
  for (const [re, name] of patterns) if (re.test(text)) return name;
  return null;
}

function articleEvidence(html, url, expectedProtocol) {
  const text = stripHtml(html);
  const protocol = extractProtocol(text) || expectedProtocol;
  const parts = scenarioParts(text);
  const allCandidates = extractCandidates(html, text);
  const firstCandidates = parts.first ? extractCandidates(parts.first, parts.first) : allCandidates;
  const secondCandidates = parts.second ? extractCandidates(parts.second, parts.second) : [];
  const published = dateFromJsonLd(html) || parseDate((text.match(/(?:publicad[ao]|divulgad[ao])[^\d]{0,10}(\d{1,2}[/. -]\d{1,2}[/. -]\d{4})/i) || [])[1]) || parseDate((url.match(/\/(20\d{2})\/(\d{2})\/(\d{2})\//) || []).slice(1).join("-"));
  const fieldwork = extractFieldwork(text);
  const n = extractN(text);
  const moe = extractMoe(text);
  const host = (() => { try { return new URL(url).hostname.toLowerCase(); } catch { return ""; } })();
  const firstRound = { scenario: "estimulada 1º turno", candidates: firstCandidates };
  const secondRoundCandidates = secondCandidates.filter((c) => ["Lula", "Flávio Bolsonaro"].includes(c.name));
  const secondRound = { scenario: "2º turno Lula x Flávio Bolsonaro", candidates: secondRoundCandidates };
  return {
    url: canonicalUrl(url),
    host,
    trusted_host: trustedHosts.has(host),
    institute: detectInstitute(text),
    protocol,
    published_date: published,
    fieldwork,
    n,
    margin_of_error: moe,
    first_round: firstRound,
    second_round: secondRound,
    text_signals: {
      says_first_round: /1o?\s*turno|primeiro\s+turno|estimulada/i.test(text),
      says_second_round: /2o?\s*turno|segundo\s+turno/i.test(text),
      has_protocol: Boolean(extractProtocol(text)),
    },
  };
}

function rssLinks(xml) {
  const out = [];
  const seen = new Set();
  for (const m of xml.matchAll(/<item[\s\S]*?<\/item>/gi)) {
    const item = m[0];
    const link = (item.match(/<link>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i) || [])[1];
    const title = (item.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i) || [])[1];
    if (!link) continue;
    try {
      const url = canonicalUrl(link.trim());
      if (seen.has(url)) continue;
      seen.add(url);
      out.push({ url, title: cleanSpace(stripHtml(title || "")) });
    } catch { /* ignore */ }
  }
  return out;
}

async function recoverProtocol(reg) {
  const q = encodeURIComponent(`"${reg.protocol}" pesquisa presidente 2026`);
  const rss = await fetchText(`https://news.google.com/rss/search?q=${q}&hl=pt-BR&gl=BR&ceid=BR:pt-419`);
  if (!rss.ok) return { articles: [], error: `rss:${rss.status || rss.error || "failed"}` };
  const links = rssLinks(rss.text).slice(0, cfg.max_rss_articles_per_protocol || 12);
  const evidence = [];
  for (const link of links) {
    const page = await fetchText(link.url);
    if (!page.ok) continue;
    const ev = articleEvidence(page.text, page.url, reg.protocol);
    if (!ev.institute) continue;
    if (ev.protocol && ev.protocol !== reg.protocol) continue;
    evidence.push(ev);
  }
  return { articles: evidence };
}

function sameCandidateMap(a, b) {
  const x = new Map((a || []).map((c) => [c.name, c.pct]));
  const y = new Map((b || []).map((c) => [c.name, c.pct]));
  const keys = new Set([...x.keys(), ...y.keys()]);
  let compared = 0;
  for (const k of keys) {
    if (!x.has(k) || !y.has(k)) continue;
    compared += 1;
    if (x.get(k) !== y.get(k)) return { same: false, compared };
  }
  return { same: compared > 0, compared };
}

function bestPollEvidence(reg, evidence, scenario) {
  const relevant = evidence.filter((e) => scenario === "estimulada 1º turno" ? e.first_round.candidates.length >= 2 : e.second_round.candidates.length >= 2);
  if (!relevant.length) return null;
  const groups = [];
  for (const e of relevant) {
    const candidates = scenario === "estimulada 1º turno" ? e.first_round.candidates : e.second_round.candidates;
    let placed = false;
    for (const g of groups) {
      const cmp = sameCandidateMap(g.candidates, candidates);
      if (cmp.same) { g.sources.push(e); placed = true; break; }
    }
    if (!placed) groups.push({ candidates, sources: [e] });
  }
  groups.sort((a, b) => {
    const score = (g) => g.sources.reduce((s, e) => s + (e.trusted_host ? 4 : 1) + (e.text_signals.has_protocol ? 4 : 0) + Math.min(4, g.candidates.length), 0);
    return score(b) - score(a);
  });
  const top = groups[0];
  if (!top) return null;
  const trusted = top.sources.filter((e) => e.trusted_host).length;
  const exactProtocol = top.sources.some((e) => e.text_signals.has_protocol && e.protocol === reg.protocol);
  const completeMeta = top.sources.some((e) => e.fieldwork?.start && e.fieldwork?.end && e.n && e.margin_of_error && e.published_date);
  const corroborated = top.sources.length >= 2 && trusted >= 1;
  const singleTrusted = trusted >= 1 && exactProtocol && completeMeta;
  if (!corroborated && !singleTrusted) return null;
  const source = top.sources[0];
  return {
    institute: source.institute || reg.institute || "",
    fieldwork_start: source.fieldwork?.start || reg.fieldwork_start,
    fieldwork_end: source.fieldwork?.end || reg.fieldwork_end,
    published_date: source.published_date || reg.planned_publication_date,
    scenario,
    candidates: top.candidates.map(({ confidence, method, ...c }) => c),
    n: source.n || reg.sample_n,
    margin_of_error: source.margin_of_error,
    source_url: source.url,
    methodology_note: `TSE ${reg.protocol}; recovered by registry-backed pipeline. Evidence: ${top.sources.map((e) => e.url).join(" | ")}`,
    tse_registration: reg.protocol,
    verification: {
      status: corroborated ? "corroborated" : "single-source-primary",
      source_count: top.sources.length,
      trusted_source_count: trusted,
      candidate_count: top.candidates.length,
    },
    verified: true,
  };
}

function pollIdentity(poll) {
  return canonicalPollKey(poll);
}

function expectedProtocols(polls) {
  const set = new Set();
  for (const p of polls) for (const protocol of pollProtocols(p)) set.add(protocol);
  return set;
}

async function main() {
  const polls = unwrapPolls(JSON.parse(fs.readFileSync(POLLS_PATH, "utf8")));
  const registry = await loadTseRegistry();
  const registryRecords = registry.records.filter((r) => Boolean(r.protocol));
  const known = expectedProtocols(polls);
  const today = new Date().toISOString().slice(0, 10);
  const graceMs = (cfg.publication_grace_days || 2) * 86400000;
  const cutoff = new Date(Date.now() - graceMs).toISOString().slice(0, 10);
  const active = registryRecords.filter((r) => !r.planned_publication_date || r.planned_publication_date <= today);
  const missing = active.filter((r) => !known.has(r.protocol));
  const limitedMissing = missing.slice(0, cfg.max_recovery_protocols || 40);

  const recovered = [];
  const conflicts = [];
  const attempted = [];

  for (const reg of limitedMissing) {
    attempted.push(reg.protocol);
    const result = await recoverProtocol(reg);
    const first = bestPollEvidence(reg, result.articles, "estimulada 1º turno");
    const second = bestPollEvidence(reg, result.articles, "2º turno Lula x Flávio Bolsonaro");
    const additions = [first, second].filter(Boolean);
    if (additions.length) {
      for (const poll of additions) {
        if (poll.fieldwork_end && poll.fieldwork_end > today) continue;
        if (!poll.published_date || poll.published_date < cutoff) continue;
        recovered.push(poll);
      }
    } else if (result.articles.length) {
      conflicts.push({ protocol: reg.protocol, reason: "evidence_found_but_not_coherent_enough", sources: result.articles.map((a) => ({ url: a.url, host: a.host })) });
    }
  }

  const ids = new Set(polls.map(pollIdentity));
  const newPolls = [];
  for (const p of recovered) {
    const id = pollIdentity(p);
    if (ids.has(id)) continue;
    ids.add(id);
    newPolls.push(p);
  }
  newPolls.sort((a, b) => String(b.fieldwork_end).localeCompare(String(a.fieldwork_end)));
  if (newPolls.length) fs.writeFileSync(POLLS_PATH, `${JSON.stringify([...newPolls, ...polls], null, 2)}\n`, "utf8");

  const stillMissing = active.filter((r) => !new Set([...known, ...newPolls.flatMap(pollProtocols).flat()]).has(r.protocol));
  const coverage = {
    registry_sha256: registry.generated_sha256,
    registry_count: registryRecords.length,
    active_registration_count: active.length,
    accounted_registration_count: active.length - stillMissing.length,
    missing_registration_count: stillMissing.length,
    attempted_recovery_count: attempted.length,
    recovered_poll_record_count: newPolls.length,
    conflict_count: conflicts.length,
    max_recovery_protocols: cfg.max_recovery_protocols || 40,
    status: conflicts.length || stillMissing.length ? "attention" : "covered",
    missing_protocols: stillMissing.map((r) => r.protocol),
    conflicts,
  };

  const registryDoc = {
    version: 1,
    source: "TSE Pesquisas Eleitorais 2026 open-data export",
    source_file: registry.source_file,
    registry_sha256: registry.generated_sha256,
    records: registryRecords,
  };
  writeJsonStable(REGISTRY_PATH, registryDoc);
  writeJsonStable(MISSING_PATH, {
    version: 1,
    status: coverage.status,
    missing_count: stillMissing.length,
    items: stillMissing,
  });
  writeJsonStable(CONFLICTS_PATH, { version: 1, conflicts });
  writeJsonStable(STATUS_PATH, coverage);

  console.log(JSON.stringify({
    registry_records: registryRecords.length,
    accounted: coverage.accounted_registration_count,
    missing: stillMissing.length,
    attempted_recovery: attempted.length,
    recovered: newPolls.length,
    conflicts: conflicts.length,
    status: coverage.status,
  }, null, 2));

  if (stillMissing.length > 0 || conflicts.length > 0) process.exitCode = 2;
}

main().catch((error) => {
  console.error("[poll-pipeline] fatal:", error);
  process.exit(1);
});
