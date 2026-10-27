import type { AccountQuotaSummary, QuotaBucket } from './types.ts'

export interface QuotaMetrics {
  b5h?: QuotaBucket
  bWeekly?: QuotaBucket
  p5h?: number
  pWeekly?: number
  score: number
  isExhausted: boolean
  reset5h: string
  resetWeekly: string
}

/**
 * Formats relative countdown string in exact parity across frontend and backend.
 */
export function formatShortCountdown(isoString?: string, lang: 'zh' | 'en' = 'zh'): string {
  if (!isoString) return '-'
  const diff = new Date(isoString).getTime() - Date.now()
  if (diff <= 0) return lang === 'zh' ? '已刷新' : 'Refreshed'
  const totalMinutes = Math.floor(diff / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const mins = totalMinutes % 60
  if (days > 0) {
    const dayUnit = lang === 'zh' ? '天' : 'd'
    return hours > 0 ? `${days}${dayUnit}${hours}h` : `${days}${dayUnit}`
  }
  if (hours > 0) {
    return `${hours}h${String(mins).padStart(2, '0')}m`
  }
  return `${mins}m`
}

/**
 * Evaluates raw Google CCA quota groups and extracts Gemini core metrics.
 * Strictly isolates Gemini family buckets to eliminate false 100% 3P readings.
 */
export function evaluateQuotaMetrics(quota?: AccountQuotaSummary, lang: 'zh' | 'en' = 'zh'): QuotaMetrics | undefined {
  if (!quota?.ok || !quota.groups) return undefined
  const allBuckets = quota.groups.flatMap(g => g.buckets)

  // Strictly isolate Gemini core buckets (gemini-5h, gemini-weekly)
  // NEVER fall back to 3p (Claude/GPT) buckets which are unused and falsely show 100%!
  const geminiBuckets = allBuckets.filter(b => /^gemini[-_]/i.test(b.bucketId || ''))
  const b5h = geminiBuckets.find(b => b.window === '5h')
    ?? allBuckets.find(b => b.window === '5h' && !/^3p[-_]/i.test(b.bucketId || ''))
  const bWeekly = geminiBuckets.find(b => b.window === 'weekly')
    ?? allBuckets.find(b => b.window === 'weekly' && !/^3p[-_]/i.test(b.bucketId || ''))

  if (!b5h && !bWeekly) return undefined

  const f5h = b5h?.remainingFraction
  const fWeekly = bWeekly?.remainingFraction
  const p5h = f5h !== undefined ? Math.round(f5h * 100) : undefined
  const pWeekly = fWeekly !== undefined ? Math.round(fWeekly * 100) : undefined

  // Score represents the effective bottleneck (Math.min of 5h and weekly)
  const score = Math.min(
    f5h !== undefined ? f5h * 100 : 100,
    fWeekly !== undefined ? fWeekly * 100 : 100,
  )

  const is5hExhausted = f5h !== undefined ? f5h <= 0 : false
  const isWeeklyExhausted = fWeekly !== undefined ? fWeekly <= 0 : false
  const isExhausted = score <= 10 || ((b5h ? is5hExhausted : true) && (bWeekly ? isWeeklyExhausted : true))

  const reset5h = b5h?.resetTime ? formatShortCountdown(b5h.resetTime, lang) : ''
  const resetWeekly = bWeekly?.resetTime ? formatShortCountdown(bWeekly.resetTime, lang) : ''

  return { b5h, bWeekly, p5h, pWeekly, isExhausted, score, reset5h, resetWeekly }
}
