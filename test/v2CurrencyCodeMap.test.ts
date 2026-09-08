import { assert } from 'chai'
import { afterEach, beforeEach, describe, it } from 'mocha'

import {
  getV2CurrencyCodeMap,
  hasV2CurrencyCodeMapSynced,
  v2CurrencyCodeMapSyncDoc
} from '../src/v3/router'
import { convertV2 } from '../src/v3/v2converter'

const resetSyncedMap = (): void => {
  v2CurrencyCodeMapSyncDoc.doc.data = {}
}

describe('getV2CurrencyCodeMap', () => {
  beforeEach(resetSyncedMap)
  afterEach(resetSyncedMap)

  it('should fall back to the bundled map when the synced document is empty', () => {
    const currencyCodeMap = getV2CurrencyCodeMap()

    assert.deepStrictEqual(currencyCodeMap.BTC, {
      pluginId: 'bitcoin',
      tokenId: null
    })
  })

  it('should prefer the synced map once it has loaded', () => {
    v2CurrencyCodeMapSyncDoc.doc.data = {
      BTC: { pluginId: 'synced-bitcoin', tokenId: null }
    }

    const currencyCodeMap = getV2CurrencyCodeMap()

    assert.strictEqual(currencyCodeMap.BTC.pluginId, 'synced-bitcoin')
  })

  // An unsynced map resolves every code to a fabricated uppercase pluginId,
  // which finds no rate and answers with a null rate and a 200 status:
  it('should resolve BTC to bitcoin rather than a fabricated pluginId when unsynced', () => {
    const result = convertV2(
      [{ currency_pair: 'BTC_iso:USD' }],
      getV2CurrencyCodeMap()
    )

    assert.strictEqual(result.crypto.length, 1)
    assert.strictEqual(result.crypto[0].asset.pluginId, 'bitcoin')
  })
})

describe('hasV2CurrencyCodeMapSynced', () => {
  beforeEach(resetSyncedMap)
  afterEach(resetSyncedMap)

  // `syncedDocument.sync()` resolves, and emits, even when it creates an empty
  // document because none existed yet. Keying this on the emit rather than on
  // the map holding entries would report a healthy instance that is really
  // serving v2 from the bundled fallback:
  it('should report unsynced while the document holds no entries', () => {
    assert.isFalse(hasV2CurrencyCodeMapSynced())
  })

  it('should report synced once the document holds entries', () => {
    v2CurrencyCodeMapSyncDoc.doc.data = {
      BTC: { pluginId: 'bitcoin', tokenId: null }
    }

    assert.isTrue(hasV2CurrencyCodeMapSynced())
  })
})
