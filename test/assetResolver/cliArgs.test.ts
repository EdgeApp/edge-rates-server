import { assert } from 'chai'
import { describe, it } from 'mocha'

import {
  flagNumber,
  flagString,
  parseCliArgs,
  positionalAsset
} from '../../src/v3/providers/assetResolver/cliArgs'

describe('parseCliArgs', function () {
  it('separates the command, positionals, valued flags, and switches', function () {
    const args = parseCliArgs([
      'apply',
      'polygon',
      '2791',
      '--file',
      'assets.json',
      '--force',
      '--model=gpt',
      '--no-slack'
    ])
    assert.equal(args.command, 'apply')
    assert.deepEqual(args.positionals, ['polygon', '2791'])
    assert.deepEqual(args.flags, {
      file: 'assets.json',
      force: true,
      model: 'gpt',
      'no-slack': true
    })
    assert.equal(flagString(args.flags, 'file'), 'assets.json')
    assert.isUndefined(flagString(args.flags, 'force'))
    assert.deepEqual(positionalAsset(args.positionals), {
      pluginId: 'polygon',
      tokenId: '2791'
    })
    assert.deepEqual(positionalAsset(['wax']), {
      pluginId: 'wax',
      tokenId: null
    })
    assert.isUndefined(positionalAsset([]))
  })

  it('defaults to help and rejects a valued flag without a value', function () {
    assert.equal(parseCliArgs([]).command, 'help')
    assert.throws(
      () => parseCliArgs(['resolve', '--file']),
      /--file needs a value/
    )
    assert.throws(
      () => parseCliArgs(['resolve', '--file', '--blind']),
      /--file needs a value/
    )
  })

  it('parses numeric flags with a fallback', function () {
    const { flags } = parseCliArgs(['calibrate', '--pairs', '60'])
    assert.equal(flagNumber(flags, 'pairs', 40), 60)
    assert.equal(flagNumber(flags, 'seed', 1), 1)
    assert.throws(
      () => flagNumber({ pairs: 'many' }, 'pairs', 40),
      /must be a number/
    )
  })
})
