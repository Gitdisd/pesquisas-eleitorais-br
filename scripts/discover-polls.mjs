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
 * Extra-file keys are treated as already present (no double plot).
 * New polls almost always use a new article URL; candidates are ranked.
 * Same-calendar-day publications are not skipped by the watermark.
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
