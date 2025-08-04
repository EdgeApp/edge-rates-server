import { DatabaseSetup, setupDatabase } from 'edge-server-tools'

import { config } from '../config'
import { apiProviders } from './providers/allProviders'

export const createDatabases = async (): Promise<void> => {
  const ratesDbs: DatabaseSetup[] = [
    {
      name: 'rates_settings',
      documents: {
        README: {
          content: [
            "Use the following format when adding default mappings to the provider's settings document:",
            '',
            '"pluginId_tokenId": { "id": "string", "slug": "name of currency, or some note" }',
            '',
            'For example:',
            '',
            '"bitcoin": { "id": "1", "slug": "bitcoin" }',
            '"ethereum_a0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": { "id": "3408", "slug": "USDC" }',
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
      }
    }
  }

  for (const setup of ratesDbs) {
    await setupDatabase(config.couchUri, setup)
  }
}
