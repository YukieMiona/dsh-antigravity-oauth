/**
 * The agy release line this route was verified against. agy updates itself in the background, so
 * the settings page flags any other line. Kept free of Node imports: the client bundle reads it.
 */
export const AGY_TESTED_LINE = '1.5'

export function isTestedAgyVersion(version: string): boolean {
  return version.startsWith(`${AGY_TESTED_LINE}.`)
}
