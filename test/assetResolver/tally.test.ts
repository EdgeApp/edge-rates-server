import { assert } from 'chai'
import { describe, it } from 'mocha'

import {
  collectUnresolvedKeys,
  parseScoredMembers
} from '../../src/v3/providers/assetResolver/tally'

describe('collectUnresolvedKeys', function () {
  const isoDate = new Date('2026-09-25T12:00:00.000Z')
  const earlier = new Date('2026-09-24T12:00:00.000Z')

  it('returns each asset without a rate once', function () {
    const keys = collectUnresolvedKeys([
      { isoDate, asset: { pluginId: 'bitcoin', tokenId: null }, rate: 64000 },
      {
        isoDate,
        asset: { pluginId: 'polygon', tokenId: 'dead' },
        rate: undefined
      },
      {
        isoDate: earlier,
        asset: { pluginId: 'polygon', tokenId: 'dead' },
        rate: undefined
      },
      { isoDate, asset: { pluginId: 'ufo', tokenId: null }, rate: undefined }
    ])
    assert.deepEqual(keys, ['polygon_dead', 'ufo'])
  })

  it('returns nothing when every asset has a rate', function () {
    const keys = collectUnresolvedKeys([
      { isoDate, asset: { pluginId: 'bitcoin', tokenId: null }, rate: 64000 },
      { isoDate, asset: { pluginId: 'ethereum', tokenId: null }, rate: 0 }
    ])
    assert.deepEqual(keys, [])
  })

  it('returns nothing for an empty request', function () {
    assert.deepEqual(collectUnresolvedKeys([]), [])
  })
})

describe('parseScoredMembers', function () {
  it('pairs members with their scores', function () {
    const counts = parseScoredMembers(['polygon_dead', '12', 'ufo', '3'])
    assert.deepEqual(Array.from(counts), [
      ['polygon_dead', 12],
      ['ufo', 3]
    ])
  })

  it('tolerates an empty or odd reply', function () {
    assert.deepEqual(Array.from(parseScoredMembers([])), [])
    assert.deepEqual(Array.from(parseScoredMembers(['ufo'])), [])
  })
})
