#!/usr/bin/env node
/**
 * Refresh/normalize canonical Brazilian election polls.
 * Writes data/polls.json + public/data/polls.json (bare Poll[]), data/meta.json + public/data/meta.json (and coverage mirrors).
 * Node builtins only (fs, path, crypto, url).
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

const DATA_POLLS = path.join(ROOT, "data", "polls.json");
const PUBLIC_POLLS = path.join(ROOT, "public", "data", "polls.json");
const META_PATH = path.join(ROOT, "data", "meta.json");
const PUBLIC_META = path.join(ROOT, "public", "data", "meta.json");
const COVERAGE_OUT = path.join(ROOT, "data", "coverage_summary.json");
const PUBLIC_COVERAGE = path.join(ROOT, "public", "data", "coverage_summary.json");

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const REQUIRED = [
  "institute",
  "fieldwork_start",
  "fieldwork_end",
  "published_date",
  "scenario",
  "candidates",
  "n",
  "margin_of_error",
  "source_url",
  "methodology_note",
  "verified",
];

function parseArgs(argv) {
  const out = { includeUnverified: false, positional: [] };
  for (const a of argv) {
    if (a === "--include-unverified") out.includeUnverified = true;
    else if (a.startsWith("--")) console.warn("[update-polls] unknown flag:", a);
    else out.positional.push(a);
  }
  return out;
}

function readJsonFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  return JSON.parse(text);
}

function unwrapPolls(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object" && Array.isArray(data.polls)) return data.polls;
  throw new Error("Source JSON must be a bare array or { polls: [...] }");
}

async function loadSource(args) {
  const cliPath = args.positional[0];
  if (cliPath) {
    const resolved = path.resolve(process.cwd(), cliPath);
    console.log("[update-polls] source: CLI", resolved);
    return { polls: unwrapPolls(readJsonFile(resolved)), label: resolved };
  }
  if (process.env.POLL_SOURCE) {
    const resolved = path.resolve(process.cwd(), process.env.POLL_SOURCE);
    console.log("[update-polls] source: POLL_SOURCE", resolved);
    return { polls: unwrapPolls(readJsonFile(resolved)), label: resolved };
  }
  if (process.env.POLL_SOURCE_URL) {
    const url = process.env.POLL_SOURCE_URL;
    console.log("[update-polls] source: POLL_SOURCE_URL", url);
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch POLL_SOURCE_URL: HTTP " + res.status);
    return { polls: unwrapPolls(await res.json()), label: url };
  }
  console.log("[update-polls] source: existing", DATA_POLLS);
  return { polls: unwrapPolls(readJsonFile(DATA_POLLS)), label: DATA_POLLS };
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function validateCandidate(c, idx, pollIdx) {
  if (!c || typeof c !== "object") return "candidates[" + idx + "] not object";
  if (!isNonEmptyString(c.name)) return "candidates[" + idx + "].name";
  if (!("party_optional" in c)) return "candidates[" + idx + "].party_optional missing";
  if (c.party_optional !== null && typeof c.party_optional !== "string") {
    return "candidates[" + idx + "].party_optional type";
  }
  if (typeof c.pct !== "number" || Number.isNaN(c.pct)) return "candidates[" + idx + "].pct";
  return null;
}

function validatePoll(poll, pollIdx) {
  if (!poll || typeof poll !== "object") return "not an object";
  for (const key of REQUIRED) {
    if (!(key in poll)) return "missing " + key;
  }
  if (!isNonEmptyString(poll.institute)) return "institute";
  if (!DATE_RE.test(poll.fieldwork_start)) return "fieldwork_start";
  if (!DATE_RE.test(poll.fieldwork_end)) return "fieldwork_end";
  if (!DATE_RE.test(poll.published_date)) return "published_date";
  if (!isNonEmptyString(poll.scenario)) return "scenario";
  if (!Array.isArray(poll.candidates) || poll.candidates.length === 0) return "candidates";
  for (let i = 0; i < poll.candidates.length; i++) {
    const err = validateCandidate(poll.candidates[i], i, pollIdx);
    if (err) return err;
  }
  if (typeof poll.n !== "number" || !(poll.n > 0)) return "n";
  if (!isNonEmptyString(poll.margin_of_error)) return "margin_of_error";
  if (!isNonEmptyString(poll.source_url)) return "source_url";
  if (!/^https?:\/\//i.test(poll.source_url)) return "source_url scheme";
  if (typeof poll.methodology_note !== "string") return "methodology_note";
  if (typeof poll.verified !== "boolean") return "verified";
  if ("flag" in poll && poll.flag != null && typeof poll.flag !== "string") return "flag";
  return null;
}

function normalizePoll(poll) {
  const out = {
    institute: poll.institute,
    fieldwork_start: poll.fieldwork_start,
    fieldwork_end: poll.fieldwork_end,
    published_date: poll.published_date,
    scenario: poll.scenario,
    candidates: poll.candidates.map((c) => ({
      name: c.name,
      party_optional: c.party_optional,
      pct: c.pct,
    })),
    n: poll.n,
    margin_of_error: poll.margin_of_error,
    source_url: poll.source_url,
    methodology_note: poll.methodology_note,
    verified: poll.verified,
  };
  if (typeof poll.flag === "string" && poll.flag.length > 0) out.flag = poll.flag;
  return out;
}

function stableSort(polls) {
  return [...polls].sort((a, b) => {
    if (a.fieldwork_end !== b.fieldwork_end) return a.fieldwork_end < b.fieldwork_end ? 1 : -1;
    if (a.published_date !== b.published_date) return a.published_date < b.published_date ? 1 : -1;
    if (a.institute !== b.institute) return a.institute < b.institute ? -1 : 1;
    if (a.scenario !== b.scenario) return a.scenario < b.scenario ? -1 : 1;
    return 0;
  });
}

function contentHash(polls) {
  const payload = JSON.stringify(polls);
  return crypto.createHash("sha256").update(payload).digest("hex");
}

function pretty(value) {
  return JSON.stringify(value, null, 2) + "\n";
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
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return `${parts.year}-${parts.month}-${parts.day}T${hour}:${parts.minute}:${parts.second}-03:00`;
}

function writeTextIfChanged(filePath, text) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  let prev = null;
  try { prev = fs.readFileSync(filePath, "utf8"); } catch { /* missing */ }
  if (prev === text) return false;
  fs.writeFileSync(filePath, text, "utf8");
  return true;
}

function syncCoverageSummary() {
  const candidates = [
    path.join(ROOT, "data", "polls_coverage_summary.json"),
    path.join(ROOT, "data", "coverage_summary.json"),
    "/workspace/polls_coverage_summary.json",
  ];
  for (const src of candidates) {
    if (!fs.existsSync(src)) continue;
    try {
      const data = readJsonFile(src);
      const body = pretty(data);
      const dataChanged = writeTextIfChanged(COVERAGE_OUT, body);
      const publicChanged = writeTextIfChanged(PUBLIC_COVERAGE, body);
      console.log(
        "[update-polls] coverage_summary:",
        dataChanged || publicChanged ? "updated from " + src : "unchanged",
        "->",
        COVERAGE_OUT,
        "+ public mirror"
      );
      return dataChanged || publicChanged;
    } catch (err) {
      console.warn("[update-polls] skip coverage from", src, err.message);
    }
  }
  console.log("[update-polls] coverage_summary: no source found");
  return false;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let loaded;
  try {
    loaded = await loadSource(args);
  } catch (err) {
    console.error("[update-polls] hard failure reading source:", err.message);
    process.exit(1);
  }

  const incoming = loaded.polls;
  const valid = [];
  let skippedInvalid = 0;
  let skippedUnverified = 0;

  for (let i = 0; i < incoming.length; i++) {
    const poll = incoming[i];
    const err = validatePoll(poll, i);
    if (err) {
      skippedInvalid += 1;
      console.warn("[update-polls] skip invalid #" + i + ":", err);
      continue;
    }
    if (!args.includeUnverified && poll.verified !== true) {
      skippedUnverified += 1;
      continue;
    }
    valid.push(normalizePoll(poll));
  }

  if (valid.length === 0) {
    console.error("[update-polls] hard failure: zero polls after filter");
    process.exit(1);
  }

  const sorted = stableSort(valid);
  const pollsText = pretty(sorted);
  const hash = contentHash(sorted);

  let prevHash = null;
  try {
    const prevPolls = unwrapPolls(readJsonFile(DATA_POLLS));
    prevHash = contentHash(prevPolls);
  } catch {
    prevHash = null;
  }
  const contentChanged = prevHash !== hash;

  const dataChanged = writeTextIfChanged(DATA_POLLS, pollsText);
  const publicChanged = writeTextIfChanged(PUBLIC_POLLS, pollsText);

  let prevMeta = null;
  try { prevMeta = readJsonFile(META_PATH); } catch { /* missing */ }
  const needsContentHash = !prevMeta || typeof prevMeta.content_hash !== "string";
  const checkedAtUtc = new Date().toISOString();
  const meta = {
    schema_version: 1,
    last_updated:
      contentChanged || !prevMeta?.last_updated
        ? nowSaoPauloIso()
        : prevMeta.last_updated,
    last_check_at: checkedAtUtc,
    check_interval_minutes: 60,
    record_count: sorted.length,
    source: "verified published polls",
    content_hash: hash,
  };
  const metaText = pretty(meta);
  const metaDataChanged = writeTextIfChanged(META_PATH, metaText);
  const metaPublicChanged = writeTextIfChanged(PUBLIC_META, metaText);
  const metaChanged = metaDataChanged || metaPublicChanged;
  if (needsContentHash && !contentChanged) {
    console.log("[update-polls] meta: backfilled content_hash without bumping last_updated");
  }
  const coverageChanged = syncCoverageSummary();

  const anyChanged = dataChanged || publicChanged || metaChanged || coverageChanged;
  console.log("[update-polls] summary");
  console.log("  source:", loaded.label);
  console.log("  records in:", incoming.length);
  console.log("  records out:", sorted.length);
  console.log("  skipped invalid:", skippedInvalid);
  console.log("  skipped unverified:", skippedUnverified);
  console.log("  content hash:", hash);
  console.log("  content hash changed:", contentChanged);
  console.log("  wrote data/polls.json:", dataChanged);
  console.log("  wrote public/data/polls.json:", publicChanged);
  console.log("  wrote data/meta.json:", metaDataChanged);
  console.log("  wrote public/data/meta.json:", metaPublicChanged);
  console.log("  coverage_summary changed:", coverageChanged);
  console.log("  files changed:", anyChanged);
  console.log("  last_updated:", meta.last_updated);
  console.log("  last_check_at:", meta.last_check_at);
}

main().catch((err) => {
  console.error("[update-polls] hard failure:", err);
  process.exit(1);
});
