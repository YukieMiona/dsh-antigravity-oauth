import { capture, parseAgyQuota, type AgyQuota } from './run.ts'
import { AGY_TESTED_LINE, isTestedAgyVersion } from './version.ts'

/**
 * Quota and version of the official CLI, refreshed in the background while the route is in use.
 * Nobody looks at the Route tab during an unattended run, so a low quota or a CLI that updated
 * itself is written to the log, and the API server's `/health` reports both.
 */
export const QUOTA_CHECK_INTERVAL_MS = 30 * 60_000
export const QUOTA_LOW_WEEKLY = 0.2
export const QUOTA_LOW_FIVE_HOUR = 0.15

export interface AgyWatchReading extends AgyQuota {
  checkedAt: string
  /** Weekly or five-hour quota below its threshold: clients should slow down. */
  low: boolean
  version?: string
}

let lastCheck = 0
let reading: AgyWatchReading | undefined

export function isQuotaLow(quota: AgyQuota): boolean {
  return (quota.weekly !== undefined && quota.weekly < QUOTA_LOW_WEEKLY)
    || (quota.fiveHour !== undefined && quota.fiveHour < QUOTA_LOW_FIVE_HOUR)
}

/** The last reading, if any. */
export function lastAgyReading(): AgyWatchReading | undefined {
  return reading
}

const pct = (value: number | undefined): string => value === undefined ? 'unknown' : `${Math.round(value * 100)}%`

/** One check: version, then quota. Each agy start is heavy, so they run one after another. */
export async function checkAgyWatch(binary: string): Promise<AgyWatchReading | undefined> {
  const version = /^(\d+\.\d+\.\d+)\s*$/m.exec((await capture(binary, ['--version'], 10_000)).stdout)?.[1]
  if (version !== undefined && version !== reading?.version) {
    if (reading?.version !== undefined) console.warn(`[dsh-antigravity-oauth] agy updated itself: ${reading.version} → ${version}`)
    if (!isTestedAgyVersion(version)) console.warn(`[dsh-antigravity-oauth] agy ${version} is outside the tested ${AGY_TESTED_LINE}.x line; the Official CLI route may not work`)
  }
  const quota = parseAgyQuota((await capture(binary, ['-p', '/usage', '--output-format', 'stream-json'], 30_000)).stdout)
  if (quota === undefined && version === undefined) return reading
  const low = quota !== undefined && isQuotaLow(quota)
  if (low && reading?.low !== true) console.warn(`[dsh-antigravity-oauth] agy quota is low: weekly ${pct(quota.weekly)}, 5h ${pct(quota.fiveHour)} left`)
  reading = {
    ...quota ?? {},
    checkedAt: new Date().toISOString(),
    low,
    ...version === undefined ? {} : { version },
  }
  return reading
}

/** Call on every request through the CLI; at most one check starts per interval. */
export function noteAgyUse(binary: string, now = Date.now()): void {
  if (now - lastCheck < QUOTA_CHECK_INTERVAL_MS) return
  lastCheck = now
  void checkAgyWatch(binary).catch(() => undefined)
}

/** For tests: forget the last reading and check time. */
export function resetAgyWatch(): void {
  lastCheck = 0
  reading = undefined
}
