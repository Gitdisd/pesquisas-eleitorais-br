#!/usr/bin/env node
/**
 * Recover poll records from PDF/HTML inbox items.
 * Uses the PDF text layer first. Image-only PDFs are rendered page-by-page
 * and OCR'd in Portuguese. Only records with complete metadata and both
 * principal-round candidates are staged; nothing is fabricated.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { execFileSync } from 'node:child_process'

const ROOT = process.cwd()
const INBOX = path.join(ROOT, 'data/discovery/inbox.json')
const EXTRA = path.join(ROOT, 'data/polls-extra.json')
const REPORT = path.join(ROOT, 'data/discovery/document-recovery.json')
const UA = 'pesquisas-eleitorais-br-document-recovery/2.0'
const OCR_MAX_PAGES = 40

const CANDIDATES = [
  ['Lula', 'PT', ['Lula', 'Luiz Inácio Lula da Silva']],
  ['Flávio Bolsonaro', 'PL', ['Flávio Bolsonaro', 'Flavio Bolsonaro']],
  ['Augusto Cury', 'Avante', ['Augusto Cury', 'Escritor Augusto Cury', 'Cury']],
  ['Renan Santos', 'Missão', ['Renan Santos', 'Renan']],
  ['Ronaldo Caiado', 'PSD', ['Ronaldo Caiado', 'Caiado']],
  ['Romeu Zema', 'Novo', ['Romeu Zema', 'Zema']],
  ['Samara Martins', 'UP', ['Samara Martins', 'Samara']],
  ['Hertz Dias', 'PSTU', ['Hertz Dias', 'Hertz']],
  ['Edmilson Costa', 'PCB', ['Edmilson Costa', 'Edmilson Dias', 'Edmilson']],
  ['Rui Costa Pimenta', 'PCO', ['Rui Costa Pimenta', 'Rui Costa', 'Pimenta']],
  ['Clariana Barão', 'DC', ['Clariana Barão', 'Clariana Barao', 'Clariana']],
  ['Wilson Grassi', 'Democrata', ['Wilson Grassi', 'Veterinário Wilson Grassi', 'Grassi']],
]

const MONTHS = {
  janeiro:'01', fevereiro:'02', marco:'03', março:'03', abril:'04', maio:'05', junho:'06',
  julho:'07', agosto:'08', setembro:'09', outubro:'10', novembro:'11', dezembro:'12',
  jan:'01', fev:'02', mar:'03', abr:'04', mai:'05', jun:'06', jul:'07', ago:'08', set:'09', out:'10', nov:'11', dez:'12'
}

const load = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback }
}
const normalize = (v) => String(v ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim()
const isoDate = (d, m, y) => `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`

function parseDate(raw) {
  if (!raw) return null
  const s = String(raw).trim()
  let m = s.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](2026)\b/)
  if (m) return isoDate(m[1], m[2], m[3])
  m = s.match(/\b(\d{1,2})\s+de\s+([A-Za-zÀ-ÿ]+)\s+de\s+(2026)\b/i)
  if (m) return MONTHS[normalize(m[2])] ? isoDate(m[1], MONTHS[normalize(m[2])], m[3]) : null
  m = s.match(/\b(2026)[-/.](\d{2})[-/.](\d{2})\b/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

function extractFieldwork(text) {
  let m = text.match(/(?:entre|de)\s+(\d{1,2})\s+(?:e|a|até|ate)\s+(\d{1,2})\s+de\s+([A-Za-zÀ-ÿ]+)\s+de\s+(2026)/i)
  if (m) {
    const month = MONTHS[normalize(m[3])]
    if (month) return { start: isoDate(m[1], month, m[4]), end: isoDate(m[2], month, m[4]) }
  }
  m = text.match(/(?:campo|coleta|entrevistas?|realizado|realizados)[^\d]{0,80}(\d{1,2}[/.\-]\d{1,2}[/.\-]2026)[^\d]{0,80}(\d{1,2}[/.\-]\d{1,2}[/.\-]2026)/i)
  if (m) {
    const start = parseDate(m[1]); const end = parseDate(m[2]); if (start && end) return { start, end }
  }
  return null
}

function extractN(text) {
  const patterns = [
    /(?:amostra|amostral|foram entrevistad[oa]s?|entrevist(?:as|ados)|n\s*=)[^\d]{0,40}(\d{1,3}(?:[.\s]\d{3})+|\d{3,5})\b/i,
    /\b(\d{1,3}(?:[.\s]\d{3})+|\d{4,5})\s+(?:pessoas|eleitores|entrevistas)/i,
  ]
  for (const re of patterns) {
    const m = text.match(re); if (!m) continue
    const n = Number(m[1].replace(/[.\s]/g,'')); if (n > 0) return n
  }
  return null
}

function extractMoe(text) {
  const m = text.match(/(?:margem(?:\s+de\s+erro)?|erro(?:\s+amostral)?)[^\d±+-]{0,40}(?:±|\+\/-|mais\s+ou\s+menos)?\s*(\d+(?:[.,]\d+)?)\s*(?:p\.p\.|pp|pontos?(?:\s+percentuais)?|%)/i)
  return m ? `±${m[1].replace(',', '.')} pp` : null
}

function extractProtocol(text) {
  const m = text.match(/\bBR\s*-?\s*\d{4,6}\s*(?:[/\-]\s*2026|\s+2026|2026)\b/i)
  return m ? m[0].replace(/\s+/g,' ').toUpperCase().replace(/BR\s*-?\s*(\d{4,6})[^\d]*2026/,'BR-$1/2026') : null
}

function institute(text) {
  const patterns = [
    [/\bdatafolha\b/i,'Datafolha'],[/\bquaest\b/i,'Quaest'],[/\bnexus\b.*\bbtg\b|\bbtg\b.*\bnexus\b/i,'Nexus/BTG'],
    [/\batlas\s*intel\b/i,'AtlasIntel'],[/\bpoder\s*data\b/i,'PoderData'],[/\bideia\b/i,'Ideia'],[/\bfutura\b/i,'Futura/Apex'],
    [/\bparan[aá]\s*pesquisas\b/i,'Paraná Pesquisas'],[/\bgerp\b/i,'GERP'],[/\bpalver\b/i,'Palver'],[/\bvox\s*brasil\b/i,'Vox Brasil'],
    [/\bcnt\s*\/?\s*mda\b|\bmda\s*\/?\s*cnt\b/i,'CNT/MDA'],[/\breal\s*time\s*big\s*data\b/i,'Real Time Big Data'],
  ]
  for (const [re,name] of patterns) if (re.test(text)) return name
  return null
}

function publishedDate(text, url) {
  let m = text.match(/(?:publicad[ao]|divulgad[ao]|divulgada em|publicada em)[^\d]{0,30}(\d{1,2}\s+de\s+[A-Za-zÀ-ÿ]+\s+de\s+2026)/i)
  if (m) { const d = parseDate(m[1]); if (d) return d }
  m = text.match(/\b(\d{1,2}[/.\-]\d{1,2}[/.\-]2026)\b/)
  if (m) { const d = parseDate(m[1]); if (d) return d }
  m = url.match(/\/(20\d{2})\/(\d{2})\/(\d{2})\b/)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

function pctNear(text, aliases, windowSize = 75) {
  const n = normalize(text)
  for (const alias of aliases) {
    const a = normalize(alias)
    let pos = n.indexOf(a)
    while (pos >= 0) {
      const window = n.slice(Math.max(0, pos - windowSize), Math.min(n.length, pos + a.length + windowSize))
      const escaped = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const after = window.match(new RegExp(`${escaped}[^\\d%]{0,${windowSize}}(\\d{1,2}(?:[.,]\\d+)?)\\s*%`, 'i'))
      const before = window.match(new RegExp(`(\\d{1,2}(?:[.,]\\d+)?)\\s*%[^a-z]{0,20}${escaped}`, 'i'))
      const val = after?.[1] ?? before?.[1]
      if (val != null) {
        const pct = Number(val.replace(',','.'))
        if (Number.isFinite(pct) && pct >= 0 && pct <= 100) return pct
      }
      pos = n.indexOf(a, pos + a.length)
    }
  }
  return null
}

function candidatesFrom(text) {
  return CANDIDATES.flatMap(([name, party, aliases]) => {
    const pct = pctNear(text, aliases)
    return pct == null ? [] : [{ name, party_optional: party, pct }]
  })
}

function scenarioSections(text) {
  const t = text.toLowerCase()
  const first = t.search(/1[ºo°]\s*turno|primeiro\s+turno|estimulada/)
  const second = t.search(/2[ºo°]\s*turno|segundo\s+turno/)
  if (first >= 0 && second >= 0) {
    if (first < second) return [{ scenario:'estimulada 1º turno', text:text.slice(first,second) },{ scenario:'2º turno Lula x Flávio Bolsonaro', text:text.slice(second) }]
    return [{ scenario:'estimulada 1º turno', text:text.slice(first) },{ scenario:'2º turno Lula x Flávio Bolsonaro', text:text.slice(second,first) }]
  }
  if (second >= 0) return [{ scenario:'2º turno Lula x Flávio Bolsonaro', text:text.slice(second) }]
  if (first >= 0) return [{ scenario:'estimulada 1º turno', text:text.slice(first) }]
  return []
}

async function download(url, target) {
  const res = await fetch(url, { redirect:'follow', headers:{'user-agent':UA,'accept':'application/pdf,text/html,*/*'} })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer()); fs.writeFileSync(target, buf)
  return { finalUrl: res.url || url, contentType: res.headers.get('content-type') || '', bytes: buf.length }
}

function pdfText(file) {
  try { return execFileSync('pdftotext',['-layout',file,'-'],{encoding:'utf8',maxBuffer:32*1024*1024}) } catch { return '' }
}

function pageCount(file) {
  try {
    const out = execFileSync('pdfinfo',[file],{encoding:'utf8'})
    const m = out.match(/\bPages:\s+(\d+)/i)
    return m ? Number(m[1]) : 1
  } catch { return 1 }
}

function ocrPdf(file, work) {
  fs.mkdirSync(work,{recursive:true})
  const pages = Math.min(pageCount(file), OCR_MAX_PAGES)
  let all = ''
  for (let page = 1; page <= pages; page++) {
    const prefix = path.join(work, `page-${page}`)
    execFileSync('pdftoppm',['-jpeg','-r','180','-f',String(page),'-singlefile',file,prefix],{stdio:'ignore'})
    const image = `${prefix}.jpg`
    try {
      all += `\n${execFileSync('tesseract',[image,'stdout','-l','por'],{encoding:'utf8',maxBuffer:8*1024*1024})}`
    } finally {
      fs.rmSync(image,{force:true})
    }
  }
  return all
}

const inboxDoc = load(INBOX,{version:1,items:[]})
const items = Array.isArray(inboxDoc.items) ? inboxDoc.items : []
const existingExtraDoc = load(EXTRA,[])
const extras = Array.isArray(existingExtraDoc) ? existingExtraDoc : (existingExtraDoc.polls || [])
const existingKeys = new Set(extras.map(p => [p.institute,p.fieldwork_start,p.fieldwork_end,p.published_date,p.scenario].join('|')))

const recovered = []
const retained = []
const failures = []
let attempted = 0

for (const item of items) {
  if (!item?.url || !/\.pdf(?:\?|$)/i.test(item.url)) { retained.push(item); continue }
  attempted++
  const temp = fs.mkdtempSync(path.join(os.tmpdir(),'poll-doc-'))
  try {
    const target = path.join(temp,'source.pdf')
    const meta = await download(item.url,target)
    let text = pdfText(target)
    const sparse = text.replace(/\s+/g,' ').trim().length < 1200
    let ocrUsed = false
    if (sparse) { text += '\n' + ocrPdf(target,temp); ocrUsed = true }

    const inst = institute(text) || item.institute
    const fw = extractFieldwork(text)
    const pub = publishedDate(text, meta.finalUrl || item.url) || item.published_date
    const n = extractN(text)
    const moe = extractMoe(text)
    const protocol = extractProtocol(text)
    const sections = scenarioSections(text)

    if (!inst || !fw || !pub || !n || !moe || !protocol || !sections.length) throw new Error('missing_poll_metadata')

    let made = 0
    for (const section of sections) {
      const cs = candidatesFrom(section.text)
      if (cs.length < 2 || !cs.some(c=>c.name==='Lula') || !cs.some(c=>c.name==='Flávio Bolsonaro')) continue
      const key = [inst,fw.start,fw.end,pub,section.scenario].join('|')
      if (existingKeys.has(key)) continue
      extras.unshift({ institute:inst, fieldwork_start:fw.start, fieldwork_end:fw.end, published_date:pub, scenario:section.scenario, candidates:cs, n, margin_of_error:moe, source_url:meta.finalUrl || item.url, methodology_note:`Document recovery; ${protocol}. ${ocrUsed ? 'OCR fallback used.' : 'PDF text layer used.'}`, verified:true })
      existingKeys.add(key); recovered.push({institute:inst,published_date:pub,scenario:section.scenario,source_url:meta.finalUrl || item.url,candidate_count:cs.length,ocr_used:ocrUsed,protocol}); made++
    }
    if (!made) throw new Error('no_new_verified_records')
  } catch (error) {
    failures.push({url:item.url,reason:String(error.message || error)})
    retained.push(item)
  } finally { fs.rmSync(temp,{recursive:true,force:true}) }
}

fs.writeFileSync(EXTRA, `${JSON.stringify(extras,null,2)}\n`, 'utf8')
fs.writeFileSync(INBOX, `${JSON.stringify({version:1,updated_at:new Date().toISOString(),items:retained},null,2)}\n`, 'utf8')
fs.writeFileSync(REPORT, `${JSON.stringify({version:2,generated_at:new Date().toISOString(),attempted,recovered_count:recovered.length,recovered,failed_count:failures.length,failures,remaining_inbox:retained.length,ocr_max_pages:OCR_MAX_PAGES},null,2)}\n`, 'utf8')
console.log(`[document-recovery] attempted=${attempted} recovered=${recovered.length} failed=${failures.length} remaining_inbox=${retained.length}`)
