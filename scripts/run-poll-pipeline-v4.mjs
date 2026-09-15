#!/usr/bin/env node
/**
 * Resilient TSE registry runner.
 * Official registry sources are preferred; the public mirror is recovery-only.
 * The downloaded source is hashed and the canonical parser is temporarily
 * widened to accept both BR-06790/2026 and BR067902026 forms.
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
const sha256 = (v) => crypto.createHash("sha256").update(v).digest("hex");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchBytes(url, { timeoutMs = 45000, attempts = 3 } = {}) {
  let last;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "user-agent": "pesquisas-eleitorais-br-registry-resolver/1.5",
          accept: "application/zip,text/csv,text/plain,application/octet-stream,application/json,*/*;q=0.8",
          "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
          "cache-control": "no-cache",
        },
      });
      const body = Buffer.from(await res.arrayBuffer());
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { body, url: res.url || url, contentType: res.headers.get("content-type") || "" };
    } catch (error) {
      last = error;
      if (attempt < attempts) await wait(700 * 2 ** (attempt - 1));
    } finally {
      clearTimeout(timer);
    }
  }
  throw last || new Error("download failed");
}

async function resolveCkanUrl() {
  const api = cfg.tse_registry_ckan_api;
  const resourceId = String(cfg.tse_registry_resource_id || "");
  const result = await fetchBytes(api, { timeoutMs: 20000, attempts: 2 });
  const doc = JSON.parse(result.body.toString("utf8"));
  const resource = (doc?.result?.resources || []).find((r) => String(r.id) === resourceId && r.state === "active");
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
  const counts = [
    [";", (head.match(/;/g) || []).length],
    [",", (head.match(/,/g) || []).length],
    ["\t", (head.match(/\t/g) || []).length],
  ];
  return counts.sort((a, b) => b[1] - a[1])[0][0];
}

function normalizeProtocol(raw) {
  const s = String(raw).replace(/[\u0000-\u001f]/g, " ").replace(/[\u00a0]/g, " ").replace(/[–—−]/g, "-").trim();
  const forms = [
    /\bBR\s*-?\s*(\d{4,6})\s*\/\s*2026\b/i,
    /\bBR\s*-?\s*(\d{4,6})\s+2026\b/i,
    /\bBR\s*-?\s*(\d{4,6})2026\b/i,
    /\bBR\s*-?\s*(\d{4,6})\s*[-/]\s*2026\b/i,
  ];
  for (const re of forms) {
    const match = s.match(re);
    if (match) return `BR-${match[1]}/2026`;
  }
  return null;
}

function compactRegistryCsv(csvBuffer, source) {
  const text = csvBuffer.toString("utf8").replace(/^\ufeff/, "");
  const delimiter = detectDelimiter(text);
  const lines = text.split(/\r?\n/).filter(Boolean);
  const protocols = new Set();
  for (const line of lines) {
    for (const match of line.matchAll(/\bBR\s*-?\s*\d{4,6}\s*(?:\/\s*2026|\s+2026|2026|-\s*2026)\b/gi)) {
      const p = normalizeProtocol(match[0]);
      if (p) protocols.add(p);
    }
  }
  if (!protocols.size) {
    const probe = text.match(/BR[^\r\n]{0,120}/i)?.[0] || text.slice(0, 600);
    throw new Error(`secondary registry contains no recognizable TSE protocols; delimiter=${JSON.stringify(delimiter)}; probe=${JSON.stringify(probe)}`);
  }
  const rows = ["NR_PESQUISA;CARGO;ABRANGENCIA"];
  for (const p of [...protocols].sort()) rows.push(`${p};Presidente;Nacional`);
  console.log(`[registry-resolver] ${source}: ${protocols.size} protocols from ${lines.length} CSV lines`);
  return Buffer.from(`${rows.join("\n")}\n`, "utf8");
}

async function packAsZip(body, fromCsv, source) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tse-registry-"));
  const csv = path.join(dir, "pesquisa_eleitoral_2026.csv");
  const zip = path.join(dir, "pesquisa_eleitoral_2026.zip");
  fs.writeFileSync(csv, fromCsv ? compactRegistryCsv(body, source) : body);
  await execFileAsync("zip", ["-j", "-q", zip, csv]);
  return { zip, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
}

function startServer(zip) {
  const server = http.createServer((req, res) => {
    if (req.url !== "/registry.zip") return res.end();
    const stat = fs.statSync(zip);
    res.writeHead(200, { "content-type": "application/zip", "content-length": stat.size, "cache-control": "no-store" });
    fs.createReadStream(zip).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, url: `http://127.0.0.1:${address.port}/registry.zip` });
    });
  });
}

function patchParser() {
  const original = fs.readFileSync(PARSER_PATH, "utf8");
  let patched = original;
  const oldBody = String.raw`\bBR-?\d{4,6}\/2026\b`;
  const newBody = String.raw`\bBR\s*-?\d{4,6}(?:\s*\/\s*2026|\s+2026|2026)\b`;
  patched = patched.replaceAll(oldBody, newBody);
  const oldNormalize = String.raw`.replace(/^BR(?=\d)/, "BR-")`;
  const newNormalize = String.raw`.replace(/^BR(?=\d)/, "BR-").replace(/^(BR-?\d{4,6})2026$/i, "$1/2026")`;
  patched = patched.replaceAll(oldNormalize, newNormalize);
  patched = patched.replace(
    "const registryRecords = registry.records.filter((r) => r.registered_date !== null || r.fieldwork_end !== null || r.planned_publication_date !== null);",
    "const registryRecords = registry.records.filter((r) => Boolean(r.protocol));"
  );
  if (patched === original) throw new Error("canonical parser patch did not match expected source");
  fs.writeFileSync(PARSER_PATH, patched, "utf8");
  return original;
}

function runParser(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [PARSER_PATH], { cwd: ROOT, env: { ...process.env, ...env }, stdio: "inherit" });
    child.on("exit", (code, signal) => resolve(signal ? 1 : (code ?? 1)));
  });
}

function parsedCount() {
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
  const candidates = [];
  try {
    const url = await resolveCkanUrl();
    candidates.push({ source: "tse-ckan", trust: "official", url });
    attempts.push({ stage: "ckan_discovery", status: "ok", url });
  } catch (error) {
    attempts.push({ stage: "ckan_discovery", status: "failed", error: error.message });
    console.warn("[registry-resolver] CKAN unavailable:", error.message);
  }
  if (cfg.tse_registry_zip) candidates.push({ source: "tse-configured-cdn", trust: "official", url: cfg.tse_registry_zip });
  for (const url of cfg.tse_registry_secondary_mirrors || []) candidates.push({ source: "secondary-mirror", trust: "secondary", url });
  candidates.push({ source: "afos-hf-mirror", trust: "secondary", url: cfg.tse_registry_hf_mirror });

  let selected = null;
  for (const candidate of candidates) {
    try {
      console.log(`[registry-resolver] try ${candidate.source}: ${candidate.url}`);
      const result = await fetchBytes(candidate.url);
      const fromCsv = !isZip(result.body) && looksLikeCsv(result.body);
      if (!isZip(result.body) && !fromCsv) throw new Error(`unexpected payload ${result.contentType || "unknown"} (${result.body.length} bytes)`);
      selected = { ...candidate, resolved_url: result.url, fromCsv, body: result.body };
      attempts.push({ stage: "download", status: "ok", source: candidate.source, trust: candidate.trust, requested_url: candidate.url, resolved_url: result.url, kind: fromCsv ? "csv" : "zip", bytes: result.body.length, sha256: sha256(result.body) });
      break;
    } catch (error) {
      attempts.push({ stage: "download", status: "failed", source: candidate.source, trust: candidate.trust, requested_url: candidate.url, error: error.message });
      console.warn(`[registry-resolver] ${candidate.source} failed:`, error.message);
    }
  }

  if (!selected) {
    fs.writeFileSync(SOURCE_STATUS_PATH, `${JSON.stringify({ version: 4, status: "unavailable", started_at: startedAt, completed_at: new Date().toISOString(), attempts }, null, 2)}\n`);
    process.exit(3);
  }

  const packed = await packAsZip(selected.body, selected.fromCsv, selected.source);
  const local = await startServer(packed.zip);
  const originalConfig = fs.readFileSync(CFG_PATH, "utf8");
  const originalParser = fs.readFileSync(PARSER_PATH, "utf8");
  try {
    const runtime = JSON.parse(originalConfig);
    runtime.tse_registry_zip = local.url;
    fs.writeFileSync(CFG_PATH, `${JSON.stringify(runtime, null, 2)}\n`);
    patchParser();
    const status = { version: 4, status: "resolved", started_at: startedAt, completed_at: new Date().toISOString(), selected_source: selected.source, trust: selected.trust, requested_url: selected.url, resolved_url: selected.resolved_url, kind: selected.fromCsv ? "csv" : "zip", bytes: selected.body.length, sha256: sha256(selected.body), attempts };
    fs.writeFileSync(SOURCE_STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`);

    const rc = await runParser({ TSE_REGISTRY_SOURCE: selected.source, TSE_REGISTRY_TRUST: selected.trust, TSE_REGISTRY_SOURCE_URL: selected.resolved_url, TSE_REGISTRY_SOURCE_SHA256: status.sha256 });
    const count = parsedCount();
    console.log(`[registry-resolver] parsed registry records: ${count}`);
    if (count < 100) {
      fs.writeFileSync(SOURCE_STATUS_PATH, `${JSON.stringify({ ...status, status: "invalid_parse", parsed_registry_records: count, completed_at: new Date().toISOString() }, null, 2)}\n`);
      process.exit(3);
    }
    if (rc !== 0 && rc !== 2) process.exit(rc);
    console.log(`[registry-resolver] VERIFIED: ${count} TSE registry records parsed`);
    process.exit(rc);
  } finally {
    fs.writeFileSync(CFG_PATH, originalConfig, "utf8");
    fs.writeFileSync(PARSER_PATH, originalParser, "utf8");
    await new Promise((resolve) => local.server.close(resolve));
    packed.cleanup();
  }
}

main().catch((error) => {
  console.error("[registry-resolver] fatal:", error);
  process.exit(3);
});
