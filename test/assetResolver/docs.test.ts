import { assert } from 'chai'
import { describe, it } from 'mocha'

import {
  applyCrossChainEntry,
  readSettingsDoc,
  removeCrossChainEntry,
  type SettingsDb,
  updateSettingsDoc
} from '../../src/v3/providers/assetResolver/docs'
import { asCrossChainMapping, asTokenMap } from '../../src/v3/types'

interface StoredDoc {
  _id: string
  _rev: string
  [key: string]: unknown
}

/** An in-memory stand-in for the rates_settings database, with revisions. */
const makeDb = (
  seed: Record<string, Record<string, unknown>> = {},
  opts: { conflicts?: number } = {}
): { db: SettingsDb; docs: Map<string, StoredDoc>; inserts: number } => {
  const docs = new Map<string, StoredDoc>()
  for (const [id, doc] of Object.entries(seed))
    docs.set(id, { ...doc, _id: id, _rev: '1-seed' })
  let conflicts = opts.conflicts ?? 0
  const state = {
    docs,
    inserts: 0,
    db: {
      get: async (id: string) => {
        const doc = docs.get(id)
        if (doc == null)
          throw Object.assign(new Error('missing'), { statusCode: 404 })
        return doc
      },
      insert: async (raw: unknown) => {
        state.inserts++
        const doc = raw as { _id: string; _rev?: string }
        if (conflicts > 0) {
          conflicts--
          throw Object.assign(new Error('conflict'), { statusCode: 409 })
        }
        const current = docs.get(doc._id)
        if (current != null && current._rev !== doc._rev) {
          throw Object.assign(new Error('conflict'), { statusCode: 409 })
        }
        const rev = `${String(Number((doc._rev ?? '0').split('-')[0]) + 1)}-x`
        const stored: StoredDoc = { ...doc, _rev: rev }
        docs.set(doc._id, stored)
        return { ok: true, id: doc._id, rev }
      }
    }
  }
  return state
}

const entry = {
  sourceChain: 'polygon',
  destChain: 'ethereum',
  currencyCode: 'USDC',
  tokenId: 'a0b8'
}

describe('settings documents', function () {
  this.timeout(10000)

  it('reads a missing document as the fallback', async function () {
    const { db } = makeDb()
    assert.deepEqual(
      await readSettingsDoc('crosschain:ai', asCrossChainMapping, {}, db),
      {}
    )
  })

  it('creates, then updates with the fresh revision', async function () {
    const { db, docs } = makeDb()
    await updateSettingsDoc(
      'crosschain:ai',
      asCrossChainMapping,
      doc => ({ ...doc, polygon_2791: entry }),
      db
    )
    assert.equal(docs.get('crosschain:ai')?._rev, '1-x')
    await updateSettingsDoc(
      'crosschain:ai',
      asCrossChainMapping,
      doc => ({ ...doc, base_dead: entry }),
      db
    )
    assert.equal(docs.get('crosschain:ai')?._rev, '2-x')
    const stored = docs.get('crosschain:ai')
    assert.deepEqual(Object.keys(stored ?? {}).sort(), [
      '_id',
      '_rev',
      'base_dead',
      'polygon_2791'
    ])
  })

  it('retries a conflict and gives up after enough of them', async function () {
    const retrying = makeDb({}, { conflicts: 2 })
    await updateSettingsDoc(
      'crosschain:ai',
      asCrossChainMapping,
      doc => ({ ...doc, polygon_2791: entry }),
      retrying.db
    )
    assert.equal(retrying.inserts, 3)
    const hopeless = makeDb({}, { conflicts: 10 })
    let failed = false
    try {
      await updateSettingsDoc(
        'crosschain:ai',
        asCrossChainMapping,
        doc => doc,
        hopeless.db
      )
    } catch (error: unknown) {
      failed = true
    }
    assert.isTrue(failed)
  })

  it('applies an AI entry only when no hand-edited document names the key', async function () {
    const { db, docs } = makeDb({
      crosschain: {},
      coingecko: { polygon_2791: { id: 'usd-coin', displayName: 'USDC' } }
    })
    let refused = false
    try {
      await applyCrossChainEntry('polygon_2791', entry, db)
    } catch (error: unknown) {
      refused = true
      assert.include(error instanceof Error ? error.message : '', 'hand-edited')
    }
    assert.isTrue(refused)
    assert.isUndefined(docs.get('crosschain:ai'))

    await applyCrossChainEntry('polygon_beef', entry, db)
    const ai = asCrossChainMapping(
      await readSettingsDoc('crosschain:ai', asCrossChainMapping, {}, db)
    )
    assert.deepEqual(ai.polygon_beef, entry)
    assert.deepEqual(await readSettingsDoc('coingecko', asTokenMap, {}, db), {
      polygon_2791: { id: 'usd-coin', displayName: 'USDC' }
    })
  })

  it('removes an AI entry and reports whether it existed', async function () {
    const { db } = makeDb({ 'crosschain:ai': { polygon_beef: entry } })
    assert.isTrue(await removeCrossChainEntry('polygon_beef', db))
    assert.isFalse(await removeCrossChainEntry('polygon_beef', db))
    assert.deepEqual(
      await readSettingsDoc('crosschain:ai', asCrossChainMapping, {}, db),
      {}
    )
  })
})
