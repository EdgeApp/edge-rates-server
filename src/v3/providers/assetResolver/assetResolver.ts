import type { RateProvider } from '../../types'
import { dailyEngine } from './engine'

/**
 * Not a rate source: this provider carries the asset resolver's settings
 * documents and its daily engine. It stays inert unless a Cursor API key is
 * configured (see `assetResolverActive` in the config).
 */
export const assetResolver: RateProvider = {
  providerId: 'assetResolver',
  type: 'api',
  documents: [
    {
      name: 'rates_settings',
      templates: {
        // Hand-edited: assets to keep out of reports and resolution
        assetResolver: {},
        // Machine-written: every asset the resolver has looked at
        'assetResolver:proposals': {},
        // Machine-written: agent batches and how they ended
        'assetResolver:batches': {},
        // Machine-written cross-chain entries; hand-edited crosschain wins
        'crosschain:ai': {}
      }
    }
  ],
  engines: [{ engine: dailyEngine, frequency: 3600 }]
}
