/**
 * Isolated GPT-OSS-20B contract audit. Not imported by production.
 * Does not change advisor prompt, model, or Write Gate.
 */
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AI_MODELS } from '@flowlary/shared'
import { CONTRACT_PACKETS } from './gpt-oss-contract/packets.ts'
import { loadGroqKey, probeAdvisor, summarize, type ProbeRecord } from './gpt-oss-contract/probe.ts'

const SPACE_MS = 2200

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

describe('gpt-oss-20b contract reliability (isolated)', () => {
  it('production advisor still uses gpt-oss-20b and json_object/180 is unchanged in source', () => {
    expect(AI_MODELS.HYPOTHESIS_ADVISOR).toBe('openai/gpt-oss-20b')
    expect(AI_MODELS.LAYOUT_CLASSIFIER).toBe('allam-2-7b')
  })

  it('probes Groq contract configs without writing', { timeout: 240_000 }, async () => {
    const key = loadGroqKey()
    expect(Boolean(key)).toBe(true)

    const records: ProbeRecord[] = []
    const queue: Array<{ packet: (typeof CONTRACT_PACKETS)[number]; maxTokens: number; format: 'json_object' | 'json_schema'; config: string }> = []

    for (const packet of CONTRACT_PACKETS) {
      queue.push({ packet, maxTokens: 180, format: 'json_object', config: 'A_json_180' })
    }
    for (const packet of CONTRACT_PACKETS) {
      queue.push({ packet, maxTokens: 512, format: 'json_object', config: 'B_json_512' })
    }
    for (const packet of CONTRACT_PACKETS) {
      queue.push({ packet, maxTokens: 1024, format: 'json_object', config: 'C_json_1024' })
    }
    for (const packet of CONTRACT_PACKETS.slice(0, 4)) {
      queue.push({ packet, maxTokens: 512, format: 'json_schema', config: 'D_schema_512' })
    }

    let consecutive429 = 0
    for (const item of queue) {
      const record = await probeAdvisor(item.packet, {
        maxTokens: item.maxTokens,
        format: item.format,
        config: item.config,
      })
      records.push(record)
      if (record.class === 'RATE_LIMIT') {
        consecutive429 += 1
        if (consecutive429 >= 6) break
        await sleep(3500)
      } else {
        consecutive429 = 0
        await sleep(SPACE_MS)
      }
    }

    const determinismPacket = CONTRACT_PACKETS[2]!
    const repeats: string[][] = []
    if (records.filter((item) => item.class === 'RATE_LIMIT').length < records.length) {
      for (let i = 0; i < 3; i += 1) {
        const record = await probeAdvisor(determinismPacket, {
          maxTokens: 512,
          format: 'json_object',
          config: 'E_determinism_512',
        })
        records.push(record)
        if (record.class === 'VALID') repeats.push(record.rankedIds)
        if (record.class === 'RATE_LIMIT') break
        await sleep(SPACE_MS)
      }
    }

    const sameRanking = repeats.length >= 2 && repeats.every((ids) => ids[0] === repeats[0]![0])
    const metrics = {
      model: 'openai/gpt-oss-20b',
      credentialsPresent: true,
      ...summarize(records),
      determinism: {
        repeats: repeats.length,
        sameTop1: repeats.length >= 2 ? sameRanking : null,
      },
      records: records.map((item) => ({
        ...item,
      })),
    }
    writeFileSync(
      resolve(import.meta.dirname, 'gpt-oss-contract/results.json'),
      `${JSON.stringify(metrics, null, 2)}\n`,
    )
    // eslint-disable-next-line no-console
    console.log('GPT_OSS_CONTRACT_METRICS', JSON.stringify({
      total: metrics.total,
      valid: metrics.valid,
      rateLimit: metrics.rateLimit,
      schemaFailure: metrics.schemaFailure,
      empty: metrics.empty,
      invalidJson: metrics.invalidJson,
      auth: metrics.auth,
      non429: metrics.non429,
      contractSuccessAmongNon429: metrics.contractSuccessAmongNon429,
      goldTop1AmongValid: metrics.goldTop1AmongValid,
      byConfig: metrics.byConfig,
      successLatency: metrics.successLatency,
      determinism: metrics.determinism,
    }, null, 2))

    expect(records.length).toBeGreaterThan(0)
    expect(records.every((item) => !('replacement' in item) || item.extraWriteFields === false || item.class !== 'VALID' || !item.extraWriteFields)).toBe(true)
  })
})
