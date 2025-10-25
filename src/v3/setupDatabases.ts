import { type DatabaseSetup, setupDatabase } from 'edge-server-tools'
import { readFileSync } from 'fs'
import { join } from 'path'

import { config } from '../config'
import { logger } from '../utils/utils'
import { apiProviders } from './providers/allProviders'

const createDatabases = async (): Promise<void> => {
  const v2CurrencyCodeMapJson = readFileSync(
    join(__dirname, '..', '..', 'data', 'v2CurrencyCodeMap.json'),
    'utf8'
  )
  const v2CurrencyCodeMap = JSON.parse(v2CurrencyCodeMapJson)
  const ratesDbs: DatabaseSetup[] = [
    {
      name: 'rates_settings',
      documents: {
        v2CurrencyCodeMap,
        README: {
          content: [
            "Use the following format when adding default mappings to the provider's settings document:",
            '',
            '"pluginId_tokenId": { "id": "string", "displayName": "name of currency, or some note" }',
            '',
            'For example:',
            '',
            '"bitcoin": { "id": "1", "displayName": "Bitcoin! or some human-readable text" }',
            '"ethereum_a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { "id": "3408", "displayName": "USDC" }',
            '',
            'pluginIds can be found here:',
            'https://github.com/EdgeApp/edge-react-gui/blob/6d443a56c0196955ca97d3615d4772c0e15978b9/src/util/corePlugins.ts#L5',
            '',
            'tokenId is typically based on the contract address but may vary from blockchain to blockchain'
          ]
        }
      },
      options: { partitioned: false },
      templates: {},
      syncedDocuments: []
    },
    {
      name: 'rates_data',
      options: { partitioned: false },
      templates: {},
      syncedDocuments: []
    }
  ]

  for (const provider of apiProviders) {
    if (provider.documents == null) continue

    for (const document of provider.documents) {
      const ratesDb = ratesDbs.find(db => db.name === document.name)
      if (ratesDb != null) {
        ratesDb.templates = {
          ...ratesDb.templates,
          ...document.templates
        }
        ratesDb.syncedDocuments?.push(...(document.syncedDocuments ?? []))
      }
    }
  }

  for (const setup of ratesDbs) {
    await setupDatabase(config.couchUri, setup)
  }
}

createDatabases()
  .then(() => process.exit(0))
  .catch(e => {
    logger('createDatabases failure', e)
  })
