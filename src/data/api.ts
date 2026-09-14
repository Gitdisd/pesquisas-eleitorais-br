import type { PollMeta, RawPoll } from './types'

export interface PollDataBundle {
  polls: RawPoll[]
  extra: RawPoll[]
  meta: PollMeta | null
}

async function readJson<T>(url: string, noStore = false): Promise<T> {
  const finalUrl = noStore ? `${url}${url.includes('?') ? '&' : '?'}v=${Date.now()}` : url
  const response = await fetch(finalUrl, noStore ? { cache: 'no-store' } : undefined)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json() as Promise<T>
}

function asPolls(value: unknown): RawPoll[] {
  if (Array.isArray(value)) return value as RawPoll[]
  if (value && typeof value === 'object' && Array.isArray((value as { polls?: unknown }).polls)) {
    return (value as { polls: RawPoll[] }).polls
  }
  return []
}

export async function loadPollData(dataUrl: string, extraUrl: string, metaUrl: string, noStore = false): Promise<PollDataBundle> {
  const [pollPayload, extraPayload, meta] = await Promise.all([
    readJson<unknown>(dataUrl, noStore),
    readJson<unknown>(extraUrl, noStore).catch(() => []),
    readJson<PollMeta>(metaUrl, noStore).catch(() => null),
  ])
  return {
    polls: asPolls(pollPayload),
    extra: asPolls(extraPayload),
    meta,
  }
}

export async function loadMeta(metaUrl: string, noStore = false): Promise<PollMeta | null> {
  return readJson<PollMeta>(metaUrl, noStore).catch(() => null)
}
