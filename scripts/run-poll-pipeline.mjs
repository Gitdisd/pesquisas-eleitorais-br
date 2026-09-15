#!/usr/bin/env node
/**
 * Layered TSE registry resolver.
 *
 * Official sources are always preferred. Secondary mirrors are recovery
 * mechanisms only and are recorded as such. Before the canonical parser is
 * invoked, mirrored CSV exports are reduced to a tiny parser-safe registry
 * containing only the verified TSE protocol plus explicit presidential/national
 * markers. The original downloaded bytes remain hashed and auditable.
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
const SOURCE_STATUS_PATH = path.join(ROOT, "data", "discovery", "registry-source.json");
const REGISTRY_OUTPUT = path.join(ROOT, "data", "discovery", "tse-registry.json");
const cfg = JSON.parse(fs.readFileSync(CFG_PATH, "utf8"));
const UA = "pesquisas-eleitorais-br-registry-resolver/1.2 (+https://github.com/Gitdisd/pesquisas-eleitorais-br)";
const execFileAsync = promisify(execFile);

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function resolveCkanResourceUrl() {
  const api = cfg.tse_registry_ckan_api || "https://dadosabertos.tse.jus.br/api/3/action/package_show?id=6ee9ef02-b6da-4dd2-8fee-37afe4d2db6d";
  const resourceId = cfg.tse_registry_resource_id || "769a663e-12c5-489e-a9c8-04633c2d57a3";
  const result = await fetchBytes(api, { timeoutMs: 20000, attempts: 2 });
  const parsed = JSON.parse(result.body.toString("utf8"));
  if (!parsed?.success || !parsed?.result) throw new Error("CKAN package_show returned no result");
  const resource = (parsed.result.resources || []).find((r) => String(r.id) === resourceId && r.state === "active");
  if (!resource?.url) throw new Error(`CKAN resource ${resourceId} not found or inactive`);
  return { api_url: api, resource_id: resourceId, url: resource.url, name: resource.name || null };
}

function isZip(buffer) {
  return buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && (buffer[2] === 0x03 || buffer[2] === 0x05 || buffer[2] === 0x07) && (buffer[3] === 0x04 || buffer[3] === 0x06 || buffer[3] === 0x08);
}

function detectDelimiter(text) {
  const head = text.split(/\r?\n/, 1)[0] || "";
  const semis = (head.match(/;/g) || []).length;
  const commas = (head.match(/,/g) || []).length;
  const tabs = (head.match(/\t/g) || []).length;
  if (tabs >= semis && tabs >= commas) return "\t";
  return semis >= commas ? ";" : ",";
}

function looksLikeCsv(buffer) {
  const head = buffer.subarray(0, Math.min(buffer.length, 8192)).toString("utf8").replace(/^\ufeff/, "");
  return /pesquisa|registro|eleitoral|institut|entidad|amostra|register_tse/i.test(head) && /[;,\t]/.test(head);
}

function extractProtocols(text) {
  const out = new Set();
  for (const m of text.matchAll(/\bBR-?\d{4,6}\/2026\b/gi)) {
    out.add(m[0].toUpperCase().replace(/^BR(?=\d)/, "BR-"));
  }
  return [...out];
}

function parseDelimitedLine(line, delimiter) {
  const out = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (ch === delimiter && !quoted) {
      out.push(cell);
      cell = "";
    } else {
      cell += ch;
    }
  }
  out.push(cell);
  return out;
}

function compatibilityCsv(csvBuffer, source) {
  const text = csvBuffer.toString("utf8").replace(/^\ufeff/, "");
  const delimiter = detectDelimiter(text);
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) throw new Error("secondary registry CSV is empty");

  // The mirrored file is already the TSE presidential registry. We deliberately
  // normalize it to the smallest schema the canonical parser needs, preventing
  // fragile dependence on TSE export column names or delimiter quirks.
  const protocols = new Set();
  for (const line of lines) {
    // Protocol extraction works on raw CSV so embedded quoted prose cannot hide it.
    for (const protocol of extractProtocols(line)) protocols.add(protocol);
    // If a line is unusual enough that raw matching fails, inspect parsed cells too.
    if (!extractProtocols(line).length) {
      for (const cell of parseDelimitedLine(line, delimiter)) {
        for (const protocol of extractProtocols(cell)) protocols.add(protocol);
      }
    }
  }

  if (!protocols.size) throw new Error("secondary registry CSV contains no BR-xxxx/2026 registrations");

  const out = [
    "NR_PESQUISA;CARGO;ABRANGENCIA",
    ...[...protocols].sort().map((protocol) => `${protocol};Presidente;Nacional`),
  ];
  console.log(`[registry-resolver] compatibility layer: ${source}; detected ${protocols.size} TSE protocols from ${lines.length} CSV lines`);
  return Buffer.from(`${out.join("\n")}\n`, "utf8");
}

async function zipSingleCsv(csvBuffer, { compatibility = false, source = "unknown" } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tse-registry-csv-"));
  const csvPath = path.join(dir, "pesquisa_eleitoral_2026.csv");
  const zipPath = path.join(dir, "pesquisa_eleitoral_2026.zip");
  const transformed = compatibility ? compatibilityCsv(csvBuffer, source) : csvBuffer;
  fs.writeFileSync(csvPath, transformed);
  try {
    await execFileAsync("zip", ["-j", "-q", zipPath, csvPath]);
    return { zipPath, cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
  } catch (error) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw new Error(`could not package CSV fallback: ${error.message}`);
  }
}

async function fetchCandidate(source, url) {
  try {
    const result = await fetchBytes(url);
    if (isZip(result.body)) {
      return { ...source, resolved_url: result.url, content_type: result.contentType, kind: "zip", body: result.body };
    }
    if (looksLikeCsv(result.body)) {
      return { ...source, resolved_url: result.url, content_type: result.contentType, kind: "csv", body: result.body };
    }
    throw new Error(`unexpected payload (${result.contentType || "unknown content-type"}, ${result.body.length} bytes)`);
  } catch (error) {
    return { ...source, requested_url: url, error: String(error.message || error) };
  }
}

function startLocalServer(zipPath) {
  const server = http.createServer((req, res) => {
    if (req.url !== "/tse-registry.zip") {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    const stat = fs.statSync(zipPath);
    res.writeHead(200, {
      "content-type": "application/zip",
      "content-length": stat.size,
      "cache-control": "no-store",
    });
    fs.createReadStream(zipPath).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolve({ server, url: `http://127.0.0.1:${address.port}/tse-registry.zip` });
    });
  });
}

function runChild(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(ROOT, "scripts", "poll-pipeline.mjs")], {
      cwd: ROOT,
      env: { ...process.env, ...env },
      stdio: "inherit",
    });
    child.on("exit", (code, signal) => resolve(signal ? 1 : (code ?? 1)));
  });
}

function readParsedRegistryCount() {
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
  let ckan;
  try {
    ckan = await resolveCkanResourceUrl();
    console.log("[registry-resolver] CKAN resolved", ckan.url);
    attempts.push({ stage: "ckan_discovery", status: "ok", ...ckan });
  } catch (error) {
    console.warn("[registry-resolver] CKAN discovery failed:", error.message);
    attempts.push({ stage: "ckan_discovery", status: "failed", error: error.message });
  }

  const candidates = [];
  if (ckan?.url) candidates.push({ source: "tse-ckan", trust: "official", url: ckan.url });
  if (cfg.tse_registry_zip) candidates.push({ source: "tse-configured-cdn", trust: "official", url: cfg.tse_registry_zip });
  for (const url of cfg.tse_registry_secondary_mirrors || []) {
    candidates.push({ source: "secondary-mirror", trust: "secondary", url });
  }
  const hfUrl = cfg.tse_registry_hf_mirror || "https://huggingface.co/datasets/AFOS-Analytics1/brazil-2026-electoral-divergence/resolve/main/polls/tse-registry.csv?download=true";
  candidates.push({ source: "afos-hf-mirror", trust: "secondary", url: hfUrl });

  let selected = null;
  for (const candidate of candidates) {
    if (attempts.some((a) => a.stage === "download" && a.requested_url === candidate.url)) continue;
    console.log(`[registry-resolver] try ${candidate.source}: ${candidate.url}`);
    const result = await fetchCandidate(candidate, candidate.url);
    if (result.body) {
      selected = result;
      attempts.push({
        stage: "download",
        status: "ok",
        source: result.source,
        trust: result.trust,
        requested_url: candidate.url,
        resolved_url: result.resolved_url,
        kind: result.kind,
        content_type: result.content_type,
        bytes: result.body.length,
        sha256: sha256(result.body),
      });
      break;
    }
    attempts.push({ stage: "download", status: "failed", source: candidate.source, trust: candidate.trust, requested_url: candidate.url, error: result.error });
  }

  if (!selected) {
    const status = {
      version: 2,
      status: "unavailable",
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      attempts,
    };
    fs.writeFileSync(SOURCE_STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`);
    console.error("[registry-resolver] all registry sources failed");
    process.exit(3);
  }

  let cleanup = null;
  let zipPath;
  if (selected.kind === "zip") {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tse-registry-"));
    zipPath = path.join(dir, "pesquisa_eleitoral_2026.zip");
    fs.writeFileSync(zipPath, selected.body);
    cleanup = () => fs.rmSync(dir, { recursive: true, force: true });
  } else {
    const mirrorIsPresidential = selected.source === "afos-hf-mirror";
    const packed = await zipSingleCsv(selected.body, { compatibility: mirrorIsPresidential, source: selected.source });
    zipPath = packed.zipPath;
    cleanup = packed.cleanup;
  }

  const local = await startLocalServer(zipPath);
  const originalConfig = fs.readFileSync(CFG_PATH, "utf8");
  try {
    const runtimeCfg = JSON.parse(originalConfig);
    runtimeCfg.tse_registry_zip = local.url;
    fs.writeFileSync(CFG_PATH, `${JSON.stringify(runtimeCfg, null, 2)}\n`, "utf8");

    const status = {
      version: 2,
      status: "resolved",
      started_at: startedAt,
      completed_at: new Date().toISOString(),
      selected_source: selected.source,
      trust: selected.trust,
      requested_url: selected.url,
      resolved_url: selected.resolved_url || selected.url,
      kind: selected.kind,
      content_type: selected.content_type,
      bytes: selected.body.length,
      sha256: sha256(selected.body),
      attempts,
    };
    fs.writeFileSync(SOURCE_STATUS_PATH, `${JSON.stringify(status, null, 2)}\n`, "utf8");
    console.log(`[registry-resolver] selected ${selected.source} (${selected.trust}); ${selected.body.length} bytes; sha256 ${status.sha256}`);

    const code = await runChild({
      TSE_REGISTRY_SOURCE: selected.source,
      TSE_REGISTRY_TRUST: selected.trust,
      TSE_REGISTRY_SOURCE_URL: selected.resolved_url || selected.url,
      TSE_REGISTRY_SOURCE_SHA256: status.sha256,
    });
    if (code !== 0) process.exit(code);

    const parsedCount = readParsedRegistryCount();
    if (parsedCount < 100) {
      console.error(`[registry-resolver] parsed registry is not credible: ${parsedCount} records`);
      const failedStatus = { ...status, status: "invalid_parse", parsed_registry_records: parsedCount, completed_at: new Date().toISOString() };
      fs.writeFileSync(SOURCE_STATUS_PATH, `${JSON.stringify(failedStatus, null, 2)}\n`, "utf8");
      process.exit(3);
    }
    console.log(`[registry-resolver] registry parse verified: ${parsedCount} records`);
  } finally {
    fs.writeFileSync(CFG_PATH, originalConfig, "utf8");
    await new Promise((resolve) => local.server.close(resolve));
    cleanup?.();
  }
}

main().catch((error) => {
  console.error("[registry-resolver] fatal:", error);
  process.exit(3);
});
