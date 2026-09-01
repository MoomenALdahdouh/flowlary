/**
 * Active account context — single authority for local account ownership.
 * accountId must be the server-authenticated id (never email / install token).
 */

export type AccountContextSnapshot = {
  accountId: string | null
  generation: number
}

const ACCOUNT_ID_PATTERN = /^[a-zA-Z0-9_-]{8,128}$/

export function isValidAccountId(value: string): boolean {
  return ACCOUNT_ID_PATTERN.test(value)
}

export class ActiveAccountContext {
  private accountId: string | null = null
  private generation = 0

  getAccountId(): string | null {
    return this.accountId
  }

  getGeneration(): number {
    return this.generation
  }

  snapshot(): AccountContextSnapshot {
    return { accountId: this.accountId, generation: this.generation }
  }

  /** Activate an authenticated account. Bumps generation to invalidate in-flight writes. */
  activate(accountId: string): AccountContextSnapshot {
    if (!isValidAccountId(accountId)) {
      throw new Error('invalid_account_id')
    }
    this.generation += 1
    this.accountId = accountId
    return this.snapshot()
  }

  /** Detach active account (logout). Does not delete account-scoped chrome.storage. */
  clear(): AccountContextSnapshot {
    this.generation += 1
    this.accountId = null
    return this.snapshot()
  }

  /** True when a write started under `expected` may still commit. */
  matches(expected: AccountContextSnapshot): boolean {
    return (
      expected.accountId != null &&
      this.accountId === expected.accountId &&
      this.generation === expected.generation
    )
  }

  requireAccountId(): string {
    if (!this.accountId) throw new Error('account_required')
    return this.accountId
  }

  /** Test helper — reset without bumping through public activate/clear semantics. */
  resetForTests(): void {
    this.accountId = null
    this.generation = 0
  }
}

export const activeAccountContext = new ActiveAccountContext()
