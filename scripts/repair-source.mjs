#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const replacements = [
  {
    file: 'src/main.js',
    from: /function tickCheckTimer\(\) \{[\s\S]*?\n\}\nasync function refreshMetaQuietly\(\) \{[\s\S]*?\n\}\nfunction startCheckTimers\(\) \{[\s\S]*?\n\}/,
    to: [
      'function tickCheckTimer() {',
      '  const lastEl = document.getElementById(\'lastCheckLine\')',
      '  const nextEl = document.getElementById(\'nextCheckLine\')',
      '  if (!lastEl || !nextEl || !state.lastCheckAt) return',
      '  const elapsed = Math.max(0, Date.now() - state.lastCheckAt.getTime())',
      '  const remaining = state.checkIntervalMs - elapsed',
      '  lastEl.textContent = `Última verificação: ${formatElapsedPt(elapsed)}`',
      '  nextEl.textContent = remaining <= 0 ? \'Verificação em andamento…\' : `Próxima verificação em: ${formatCountdown(remaining)}`',
      '}',
      'async function refreshDataQuietly() {',
      '  const bust = `?v=${Date.now()}`',
      '  try {',
      '    const [pollRes, extraRes, meta] = await Promise.all([',
      '      fetch(DATA_URL + bust, { cache: \'no-store\' }),',
      '      fetch(EXTRA_URL + bust, { cache: \'no-store\' }),',
      '      loadMeta(true),',
      '    ])',
      '    if (!pollRes.ok) throw new Error(`HTTP ${pollRes.status}`)',
      '    const data = await pollRes.json()',
      '    const base = Array.isArray(data) ? data : data.polls || []',
      '    let extra = []',
      '    if (extraRes.ok) {',
      '      try {',
      '        const ex = await extraRes.json()',
      '        extra = Array.isArray(ex) ? ex : ex.polls || []',
      '      } catch {}',
      '    }',
      '    const nextRaw = mergePolls(base, extra)',
      '    const nextPolls = normalize(nextRaw)',
      '    const nextHash = JSON.stringify(nextRaw)',
      '    const prevHash = JSON.stringify(state.raw)',
      '    if (nextHash !== prevHash) {',
      '      state.raw = nextRaw',
      '      state.polls = nextPolls',
      '      state.allInstitutes = [...new Set(state.polls.map((p) => p.institute))].sort((a, b) => a.localeCompare(\'pt-BR\'))',
      '      state.institutes = new Set(state.allInstitutes)',
      '      renderInstituteChips(); renderLegend(); renderCards(); renderTable(); syncWindowUI()',
      '      if (state.chart) state.chart.destroy()',
      '      state.chart = createPollChart(document.getElementById(\'pollChart\'), chartOpts())',
      '      document.getElementById(\'chartError\').textContent = \'\'',
      '    }',
      '    if (meta) {',
      '      state.meta = meta',
      '      state.updatedLabel = resolveUpdatedStamp(meta, state.polls)',
      '      applyCheckMeta(meta)',
      '      setStamp()',
      '    }',
      '    tickCheckTimer()',
      '  } catch (err) {',
      '    const errorEl = document.getElementById(\'chartError\')',
      '    if (errorEl) errorEl.textContent = `Atualização automática falhou: ${err.message}`',
      '  }',
      '}',
      'async function refreshMetaQuietly() {',
      '  await refreshDataQuietly()',
      '}',
      'function startCheckTimers() {',
      '  if (state.checkTimerId) clearInterval(state.checkTimerId)',
      '  if (state.metaPollId) clearInterval(state.metaPollId)',
      '  tickCheckTimer()',
      '  state.checkTimerId = setInterval(tickCheckTimer, 1000)',
      '  state.metaPollId = setInterval(refreshDataQuietly, 60_000)',
      '}',
    ].join('\n'),
  },
  {
    file: 'src/main.js',
    from: /async function loadMeta\(\) \{\n  try \{ const res = await fetch\(META_URL\); return res\.ok \? await res\.json\(\) : null \} catch \{ return null \}\n\}/,
    to: [
      'async function loadMeta(noStore = false) {',
      '  try {',
      '    const url = noStore ? META_URL + "?v=" + Date.now() : META_URL',
      '    const res = await fetch(url, noStore ? { cache: "no-store" } : undefined)',
      '    return res.ok ? await res.json() : null',
      '  } catch { return null }',
      '}',
    ].join('\n'),
  },
  {
    file: 'src/main.js',
    from: /const DEFAULT_CHECK_INTERVAL_MINUTES = 190/,
    to: 'const DEFAULT_CHECK_INTERVAL_MINUTES = 60',
  },
]

for (const r of replacements) {
  const file = path.join(root, r.file)
  let text = fs.readFileSync(file, 'utf8')
  if (!r.from.test(text)) continue
  text = text.replace(r.from, r.to)
  fs.writeFileSync(file, text)
}

const indexPath = path.join(root, 'index.html')
let index = fs.readFileSync(indexPath, 'utf8')
if (/fetch-bust\.js/.test(index)) {
  index = index.split('\n').filter((line) => !/fetch-bust\.js/.test(line)).join('\n')
  fs.writeFileSync(indexPath, index)
}

const updatePath = path.join(root, 'scripts/update-polls.mjs')
let update = fs.readFileSync(updatePath, 'utf8')
if (/check_interval_minutes:\s*60/.test(update)) {
  update = update.replace(/check_interval_minutes:\s*60/g, 'check_interval_minutes: Number(process.env.CHECK_INTERVAL_MINUTES || 60)')
  fs.writeFileSync(updatePath, update)
}

console.log('repair-source: deterministic repairs checked')
