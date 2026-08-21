/**
 * Token bucket for the Groq free tier.
 *
 * MEASURED, not assumed: a phrasing call costs ~700 input tokens cold and ~510
 * with the prefix cache warm. Against the free tier's 8,000 TPM that is ~10-15
 * calls per minute — and TOKENS are the binding constraint, not requests. A
 * 9-player Reading wants ~14 utterances, fired in a burst of seconds.
 *
 * So this bucket DECLINES BEFORE DISPATCH rather than absorbing a 429. A
 * decline is not an error: it routes to the Tier 1 template, which is the same
 * path every other failure takes. Nothing ever queues and nothing ever waits —
 * latency stays bounded by one call, never by a backlog.
 *
 * Limits are Groq's published free-tier figures for the gpt-oss models.
 */

export const GROQ_FREE = {
  requestsPerMinute: 30,
  tokensPerMinute: 8000,
  requestsPerDay: 1000,
};

export class TokenBucket {
  /** @param {{requestsPerMinute:number, tokensPerMinute:number, requestsPerDay:number}} limits */
  constructor(limits = GROQ_FREE, now = Date.now()) {
    this.limits = limits;
    // Start at 60% rather than full: a burst on the very first Reading would
    // otherwise spend the whole minute's budget before the cache is even warm.
    this.reqTokens = limits.requestsPerMinute * 0.6;
    this.tokTokens = limits.tokensPerMinute * 0.6;
    this.dayUsed = 0;
    this.dayStart = now;
    this.last = now;
    this.declined = 0;
    this.granted = 0;
  }

  refill(now) {
    const dt = Math.max(0, now - this.last) / 1000;
    this.last = now;
    this.reqTokens = Math.min(this.limits.requestsPerMinute,
      this.reqTokens + (this.limits.requestsPerMinute / 60) * dt);
    this.tokTokens = Math.min(this.limits.tokensPerMinute,
      this.tokTokens + (this.limits.tokensPerMinute / 60) * dt);
    if (now - this.dayStart > 24 * 60 * 60 * 1000) { this.dayUsed = 0; this.dayStart = now; }
  }

  /**
   * @param {number} estTokens estimated input+output tokens for this call
   * @returns {{ok:boolean, why?:string}}
   */
  tryTake(estTokens, now = Date.now()) {
    this.refill(now);
    if (this.dayUsed >= this.limits.requestsPerDay) { this.declined++; return { ok: false, why: 'daily-cap' }; }
    if (this.reqTokens < 1) { this.declined++; return { ok: false, why: 'rpm' }; }
    if (this.tokTokens < estTokens) { this.declined++; return { ok: false, why: 'tpm' }; }
    this.reqTokens -= 1;
    this.tokTokens -= estTokens;
    this.dayUsed++;
    this.granted++;
    return { ok: true };
  }

  /** A 429 arrived anyway — trust the server over the local estimate. */
  penalize(retryAfterSeconds = 5) {
    this.reqTokens = 0;
    this.tokTokens = 0;
    this.last = Date.now() + retryAfterSeconds * 1000;
  }

  stats() {
    return {
      granted: this.granted,
      declined: this.declined,
      dayUsed: this.dayUsed,
      dayCap: this.limits.requestsPerDay,
      reqAvailable: Math.floor(this.reqTokens),
      tokAvailable: Math.floor(this.tokTokens),
    };
  }
}

/**
 * Which utterances are worth spending budget on.
 *
 * Deterministic and content-ranked, never random. Claims and accusations carry
 * the game's actual information; hedges, questions and table-observations are
 * texture. Ranking this way makes the Tier 1 / Tier 2 seam consistent — the
 * eloquent lines are always the ones that matter — instead of arbitrary, which
 * is what reads as a bug.
 */
export const INTENT_PRIORITY = {
  claim: 10,      // the single most consequential thing a soul says all game
  accuse: 8,
  defend: 6,
  question: 3,
  observe: 2,
  hedge: 1,
};

export const worthPhrasing = (intent, floor = 5) =>
  (INTENT_PRIORITY[intent?.kind] ?? 0) >= floor;
