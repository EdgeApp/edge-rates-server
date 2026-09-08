import { type DatabaseSetup, setupDatabase } from 'edge-server-tools'

import { config } from '../config'
import { logger } from '../utils/utils'
import { bundledV2CurrencyCodeMap } from './bundledCurrencyCodeMap'
import { apiProviders } from './providers/allProviders'

const createDatabases = async (): Promise<void> => {
  // `asV2CurrencyCodeMapDoc` reads the map out of a `data` field, and
  // `setupDatabase` overwrites any document that does not match. Seeding the
  // bare map here would rewrite the document into a shape the cleaner reads as
  // empty, which breaks every v2 rate lookup:
  const v2CurrencyCodeMap = { data: bundledV2CurrencyCodeMap }
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
