import './style.css'
import 'hammerjs'
import { CANDIDATES, matchCandidate, parseMoe, isFirstRound, isSecondRound } from './candidates.js'
import { createPollChart, updatePollChart, resetZoom, resetYScale, applyThemeToChart } from './chart.js'
import { weightedTrend, trendAt, fmtPct, fmtDelta, fmtDateBR, formatUpdatedStamp } from './aggregate.js'
import { PROJECTION_COPY_PT } from './projection.js'

const DATA_URL = `${import.meta.env.BASE_URL}data/polls.json`
const EXTRA_URL = `${import.meta.env.BASE_URL}data/polls-extra.json`
const META_URL = `${import.meta.env.BASE_URL}data/meta.json`
