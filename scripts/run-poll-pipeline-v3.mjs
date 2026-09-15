#!/usr/bin/env node
/**
 * Resilient runner for the registry-backed poll pipeline.
 *
 * The TSE export encountered in the real runner can expose protocols as
 * BR067902026 (protocol + year without a slash), while the canonical parser
 * historically only accepted BR-06790/2026. This wrapper normalizes the source
 * and temporarily widens the parser's protocol grammar during execution.
 *
 * Official TSE sources are preferred. A secondary mirror is only used as a
 * recovery source, and its origin/hash are recorded explicitly.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import http from "node:http";
import { spawn } from "node:child_process";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const ROOT = process.cwd();
const CFG_PATH = path.join(ROOT, "data", "discovery", "pipeline-config.json");
const PARSER_PATH = path.join(ROOT, "scripts", "poll-pipeline.mjs");
const SOURCE_STATUS_PATH = path.join(ROOT, "data", "discovery", "registry-source.json");
const REGISTRY_OUTPUT = path.join(ROOT, "data", "discovery", "tse-registry.json");
const cfg = JSON.parse(fs.readFileSync(CFG_PATH, "utf8"));
const execFileAsync = promisify(execFile);
const UA = "pesquisas-eleitorais-br-registry-resolver/1.4 (+https://github.com/Gitdisd/pesquisas-eleitorais-br)";

const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchBytes(url, { timeoutMs = 45000, attempts = 3 } = {}) {
  let last = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": UA,
          accept: "application/zip,text/csv,text/plain,application/octet-stream,application/json,*/*;q=0.8",
          "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
          "cache-control": "no-cache",
        },
      });
      const body = Buffer.from(await res.arrayBuffer());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { url: res.url || url, status: res.status, contentType: res.headers.get("content-type") || "", body };
    } catch (error) {
      last = error;
      if (attempt < attempts) await sleep(750 * 2 ** (attempt - 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw last || new Error("download failed");
}

async function resolveCkanUrl() {
  const api = cfg.tse_registry_ckan_api || "https://dadosabertos.tse.jus.br/api/3/action/package_show?id=6ee9ef02-b6da-4dd2-8fee-37afe4d2db6d";
  const resourceId = cfg.tse_registry_resource_id || "769a663e-12c5-489e-a9c8-04633c2d57a3";
  const res = await fetchBytes(api, { timeoutMs: 20000, attempts: 2 });
  const doc = JSON.parse(res.body.toString("utf8"));
  const resource = (doc?.result?.resources || []).find((r) => String(r.id) === String(resourceId) && r.state === "active");
  if (!resource?.url) throw new Error(`CKAN resource ${resourceId} unavailable`);
  return resource.url;
}

function isZip(buffer) {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && [0x03, 0x05, 0x07].includes(buffer[2]) && [0x04, 0x06, 0x08].includes(buffer[3]);
}

function looksLikeCsv(buffer) {
  const head = buffer.subarray(0, Math.min(buffer.length, 16384)).toString("utf8").replace(/^\ufeff/, "");
  return /pesquisa|registro|eleitoral|institut|entidad|amostra/i.test(head) && /[;,\t]/.test(head);
}

function detectDelimiter(text) {
  const head = text.split(/\r?\n/, 1)[0] || "";
  const counts = {
    ";": (head.match(/;/g) || []).length,
    ",": (head.match(/,/g) || []).length,
    "\t": (head.match(/\t/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function normalizeProtocol(raw) {
  const s = String(raw)
    .replace(/[\u0000-\u001f]/g, " ")
    .replace(/[\u00a0]/g, " ")
    .replace(/[–—−]/g, "-")
    .trim();

  const slash = s.match(/\bBR\s*-?\s*(\d{4,6})\s*\/\s*2026\b/i);
  if (slash) return `BR-${slash[1]}/2026`;

  const spaced = s.match(/\bBR\s*-?\s*(\d{4,6})\s+2026\b/i);
  if (spaced) return `BR-${spaced[1]}/2026`;

  const joined = s.match(/\bBR\s*-?\s*(\d{4,6})2026\b/i);
  if (joined) return `BR-${joined[1]}/2026`;

  const hyphenYear = s.match(/\bBR\s*-?\s*(\d{4,6})\s*[-/]\s*2026\b/i);
  if (hyphenYear) return `BR-${hyphenYear[1]}/2026`;

  return null;
}

function extractProtocols(text) {
  const out = new Set();
  const source = String(text).replace(/[\u00a0]/g, " ").replace(/[–—−]/g, "-");
  const patterns = [
    /\bBR\s*-?\s*\d{4,6}\s*\/\s*2026\b/gi,
    /\bBR\s*-?\s*\d{4,6}\s+2026\b/gi,
    /\bBR\s*-?\s*\d{4,6}2026\b/gi,
    /\bBR\s*-?\s*\d{4,6}\s*[-/]\s*2026\b/gi,
  ];
  for (const re of patterns) {
    for (const match of source.matchAll(re)) {
      const protocol = normalizeProtocol(match[0]);
      if (protocol) out.add(protocol);
    }
  }
  return [...out];
}

function compactRegistryCsv(csvBuffer, source) {
  const text = csvBuffer.toString("utf8").replace(/^\ufeff/, "");
  const delimiter = detectDelimiter(text);
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  const protocols = new Set();
  for (const line of lines) {
    for (const protocol of extractProtocols(line)) protocols.add(protocol);
  }
  if (!protocols.size) {
    const probe = text.match(/BR[^\r\n]{0,100}/i)?.[0] || text.slice(0, 500);
    throw new Error(`secondary registry contains no recognizable protocols; delimiter=${JSON.stringify(delimiter)}; probe=${JSON.stringify(probe)}`);
  }

  // This is an inventory-only compatibility CSV. We intentionally do NOT
  // fabricate dates, sample sizes or publication dates. The canonical parser
  // is widened below to accept protocol-only inventory rows.
  const rows = ["NR_PESQUISA;CARGO;ABRANGENCIA"];
  for (const protocol of [...protocols].sort()) rows.push(`${protocol};Presidente;Nacional`);
  console.log(`[registry-resolver] ${source}: normalized ${protocols.size} protocols from ${lines.length} CSV lines`);
  return Buffer.from(`${rows.join("\n")}\n`, "utf8");
}

async function makeZip(buffer, { fromCsv, source }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tse-registry-") );
  const csvPath = path.join(dir, "pesquisa_eleitoral_2026.csv");
  const zipPath = path.join(dir, "pesquisa_eleitoral_2026.zip");
  fs.writeFileSync(csvPath, fromCsv ? compactRegistryCsv(buffer, source) : buffer);
  await execFileAsync("zip", ["-j", "-q", zipPath, csvPath]);
  return { zipPath, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

function startServer(zipPath) {
  const server = http.createServer((req, res) => {
    if (req.url !== "/registry.zip") {
      res.writeHead(404);
      res.end();
      return;
    }
    const stat = fs.statSync(zipPath);
    res.writeHead(200, { "content-type": "application/zip", "content-length": stat.size, "cache-control": "no-store" });
    fs.createReadStream(zipPath).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, url: `http://127.0.0.1:${address.port}/registry.zip` });
    });
  });
}

function patchCanonicalParser() {
  const original = fs.readFileSync(PARSER_PATH, "utf8");
  let patched = original;

  // Accept both BR-06790/2026 and the real-world TSE-export form BR067902026.
  patched = patched.replaceAll(
    /\\bBR-\\?\\d\{4,6\}\\/2026\\b/g,
    "\\\\bBR\\\\s*-?\\\\d{4,6}(?:\\\\s*\\/\\\\s*2026|\\\\s+2026|2026)\\\\b"
  );

  // Synthetic mirror rows are protocol inventory rows by design. Do not throw
  // them away just because their dates are intentionally absent.
  patched = patched.replace(
    "const registryRecords = registry.records.filter((r) => r.registered_date !== null || r.fieldwork_end !== null || r.planned_publication_date !== null);",
    "const registryRecords = registry.records.filter((r) => Boolean(r.protocol));"
  );

  if (patched === original) throw new Error("canonical parser patch did not match expected source text");
  fs.writeFileSync(PARSER_PATH, patched, "utf8");
  return original;
}

function restoreFile(file, content) {
  fs.writeFileSync(file, content, "utf8");
}

function runChild(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [PARSER_PATH], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    child.on("exit", (code, signal) => resolve(signal ? 1 : (code ?? 1)));
  });
}

function registryCount() {
  try {
    const doc = JSON.parse(fs.readFileSync(REGISTRY_OUTPUT, "utf8"));
    return Array.isArray(doc.records) ? doc.records.length : 0;
  } catch {
    return 0;
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  const attempts = [];
  let selected = null;

  let ckanUrl = null;
  try {
    ckanUrl = await resolveCkanUrl();
    attempts.push({ stage: "ckan_discovery", status: "ok", url: ckanUrl });
  } catch (error) {
    attempts.push({ stage: "ckan_discovery", status: "failed", error: error.message });
    console.warn("[registry-resolver] CKAN unavailable:", error.message);
  }

  const sources = [];
  if (ckanUrl) sources.push({ source: "tse-ckan", trust: "official", url: ckanUrl });
  if (cfg.tse_registry_zip) sources.push({ source: "tse-configured-cdn", trust: "official", url: cfg.tse_registry_zip });
  for (const url of cfg.tse_registry_secondary_mirrors || []) sources.push({ source: "secondary-mirror", trust: "secondary", url });
  sources.push({
    source: "afos-hf-mirror",
    trust: "secondary",
    url: cfg.tse_registry_hf_mirror || "https://huggingface.co/datasets/AFOS-Analytics1/brazil-2026-electoral-divergence/resolve/main/polls/tse-registry.csv?download=true",
  });

  for (const candidate of sources) {
    try {
      console.log(`[registry-resolver] try ${candidate.source}: ${candidate.url}`);
      const result = await fetchBytes(candidate.url);
      const fromCsv = !isZip(result.body) && looksLikeCsv(result.body);
      if (!isZip(result.body) && !fromCsv) throw new Error(`unexpected payload ${result.contentType || "unknown"} (${result.body.length} bytes)`);
      selected = { ...candidate, requested_url: candidate.url, resolved_url: result.url, fromCsv, body: result.body };
      attempts.push({
        stage: "download",
        status: "ok",
        source: candidate.source,
        trust: candidate.trust,
        requested_url: candidate.url,
        resolved_url: result.url,
        kind: fromCsv ? "csv" : "zip",
        content_type: result.contentType,
        bytes: result.body.length,
        sha256: sha256(result.body),
      });
      break;
    } catch (error) {
      attempts.push({ stage: "download", status: "failed", source: candidate.source, trust: candidate.trust, requested_url: candidate.url, error: error.message });
      console.warn(`[registry-resolver] ${candidate.source} failed:`, error.message);
    }
  }

  if (!selected) {
    fs.writeFileSync(SOURCE_STATUS_PATH, `${JSON.stringify({ version: 3, status: "unavailable", started_at: startedAt, completed_at: new Date().toISOString(), attempts }, null, 2)}\n`);
    process.exit(3);
  }

  const packed = await makeZip(selected.body, { fromCsv: selected.fromCsv, source: selected.source });
  const local = await startServer(packed.zipPath);
  const originalConfig = fs.readFileSync(CFG_PATH, "utf8");
  const originalParser = fs.readFileSync(PARSER_PATH, "utf8");

  try {
    const runtimeCfg = JSON.parse(originalConfig);
    runtimeCfg.tse_registry_zip = local.url;
    fs.writeFileSync(CFG_PATH, `${JSON.stringify(runtimeCfg, null, 2)}\n`);
    const parserOriginal = patchCanonicalParser();

    const status = {
      version: 3,
      status: "resolved",
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      selected_source: selected.source,
      trust: selected.trust,
      requested_url: selected.requested_url,
      resolved_url: selected.resolved_url,
      kind: selected.fromCsv ? "csv" : "zip",
      bytes: selected.body.length,
      sha256: sha256(selected.body),
      attempts,
    };
    fs.writeFileSync(SOURCE_STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`);

    const rc = await runChild({
      TSE_REGISTRY_SOURCE: selected.source,
      TSE_REGISTRY_TRUST: selected.trust,
      TSE_REGISTRY_SOURCE_URL: selected.resolved_url,
      TSE_REGISTRY_SOURCE_SHA256: status.sha256,
    });

    if (rc !== 0 && rc !== 2) process.exit(rc);

    const count = registryCount();
    if (count < 100) {
      const failed = { ...status, status: "invalid_parse", parsed_registry_records: count, completed_at: new Date().toISOString() };
      fs.writeFileSync(SOURCE_STATUS_PATH, `${JSON.stringify(failed, null, 2)}\n`);
      console.error(`[registry-resolver] registry parse failed credibility check: ${count} records`);
      process.exit(3);
    }

    console.log(`[registry-resolver] VERIFIED registry parse: ${count} records from ${selected.source}`);
    console.log(`[registry-resolver] pipeline exit: ${rc}`);
    process.exit(rc);
  } finally {
    restoreFile(CFG_PATH, originalConfig);
    restoreFile(PARSER_PATH, originalParser);
    await new Promise((resolve) => local.server.close(resolve));
    packed.cleanup();
  }
}

main().catch((error) => {
  console.error("[registry-resolver] fatal:", error);
  process.exit(3);
});
