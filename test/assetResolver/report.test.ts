import { assert } from 'chai'
import { describe, it } from 'mocha'

import type { ClassifierContext } from '../../src/v3/providers/assetResolver/classify'
import {
  classReportSections,
  formatReport,
  selectReportedAssets
} from '../../src/v3/providers/assetResolver/report'

const context: ClassifierContext = {
  tokenTypes: { ethereum: 'evm', polygon: 'evm', ufo: null },
  platforms: { ethereum: 'ethereum', polygon: 'polygon-pos', ufo: null },
  mappedKeys: new Set(['bitcoin', 'ethereum']),
  crossChain: {}
}
const rightNow = new Date('2026-09-25T16:05:00.000Z')
const counts = new Map<string, number>([
  ['polygon_dead', 12],
  ['ufo', 3],
  ['FOOBAR', 3],
  ['bitcoin', 1],
  ['polygon_beef', 40]
])

describe('selectReportedAssets', function () {
  it('classifies, sorts by count then key, and drops ignored assets', function () {
    const selection = selectReportedAssets(counts, {
      context,
      ignore: { ufo: { reason: 'no market', until: undefined } },
      rightNow,
      topN: 50
    })
    assert.deepEqual(
      selection.entries.map(entry => [
        entry.key,
        entry.count,
        entry.assetClass
      ]),
      [
        ['polygon_beef', 40, 'unmapped-token'],
        ['polygon_dead', 12, 'unmapped-token'],
        ['FOOBAR', 3, 'v2-unknown-code'],
        ['bitcoin', 1, 'mapped-unpriced']
      ]
    )
    assert.equal(selection.total, 4)
    assert.equal(selection.ignored, 1)
  })

  it('caps the shown entries but counts them all', function () {
    const selection = selectReportedAssets(counts, {
      context,
      ignore: {},
      rightNow,
      topN: 2
    })
    assert.equal(selection.entries.length, 2)
    assert.equal(selection.total, 5)
  })
})

describe('formatReport', function () {
  it('renders the header, the class sections in order, and the footer', function () {
    const selection = selectReportedAssets(counts, {
      context,
      ignore: { ufo: { reason: 'no market', until: undefined } },
      rightNow,
      topN: 3
    })
    const text = formatReport({
      day: '2026-09-25',
      selection,
      sections: classReportSections(selection.entries),
      footer: ['Silence an entry: edit rates_settings/assetResolver']
    })
    assert.equal(
      text,
      [
        '[asset-resolver] 2026-09-25: 4 assets returned without a rate since the last report (top 3 shown); 1 ignored',
        'UNMAPPED TOKENS',
        '- polygon_beef (40)',
        '- polygon_dead (12)',
        'V2 UNKNOWN CODES (add them to v2CurrencyCodeMap)',
        '- FOOBAR (3)',
        'Silence an entry: edit rates_settings/assetResolver'
      ].join('\n')
    )
  })

  it('returns nothing when there is nothing to report', function () {
    const selection = selectReportedAssets(new Map(), {
      context,
      ignore: {},
      rightNow,
      topN: 50
    })
    assert.isUndefined(
      formatReport({ day: '2026-09-25', selection, sections: [], footer: [] })
    )
  })
})
