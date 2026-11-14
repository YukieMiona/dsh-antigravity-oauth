/**
 * Google's answer when it disabled an account, e.g. 403 `TOS_VIOLATION` ("This service has been
 * disabled in this account for violation of Terms of Service"). Retrying the same account never helps.
 */
const BANNED = /\bTOS_VIOLATION\b|violation of Terms of Service|\bACCOUNT_DISABLED\b|\bUSER_SUSPENDED\b|\bACCOUNT_SUSPENDED\b|\baccount_forbidden\b/i

export function isAccountBannedError(message: string): boolean {
  return BANNED.test(message)
}
