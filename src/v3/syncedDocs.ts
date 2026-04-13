import { type SyncedDocument, watchDatabase } from 'edge-server-tools'

import { coingeckoSyncedDocuments } from './providers/coingecko/coingecko'
import { coinmarketcapSyncedDocuments } from './providers/coinmarketcap/coinmarketcap'
import { constantRatesSyncedDocuments } from './providers/constantRates'
import { dbSettings } from './providers/couch'
import { routerSyncedDocuments } from './router'
import { create30MinuteSyncInterval } from './utils'

export const v3SyncedDocuments: Array<SyncedDocument<unknown>> = [
  ...routerSyncedDocuments,
  ...coingeckoSyncedDocuments,
  ...coinmarketcapSyncedDocuments,
  ...constantRatesSyncedDocuments
]

let bootstrapPromise: Promise<void> | undefined

export const bootstrapV3SyncedDocs = async (): Promise<void> => {
  bootstrapPromise ??= (async () => {
    console.log('Starting v3 synced doc bootstrap')

    const syncResults = await Promise.allSettled(
      v3SyncedDocuments.map(async syncedDocument => {
        await syncedDocument.sync(dbSettings)
      })
    )
    const failedDocIds = syncResults.flatMap((result, index) =>
      result.status === 'rejected' ? [v3SyncedDocuments[index].id] : []
    )

    if (failedDocIds.length > 0) {
      console.warn(
        `Initial v3 synced doc load completed with ${
          failedDocIds.length
        } failure(s): ${failedDocIds.join(', ')}`
      )
    } else {
      console.log('Initial v3 synced doc load complete')
    }

    for (const syncedDocument of v3SyncedDocuments) {
      create30MinuteSyncInterval(syncedDocument, dbSettings)
    }

    try {
      await watchDatabase(dbSettings, {
        syncedDocuments: v3SyncedDocuments,
        onError: (error: unknown) => {
          console.error('rates_settings watcher error', error)
        }
      })
      console.log('Watching rates_settings for synced doc changes')
    } catch (error) {
      console.error('Failed to start rates_settings watcher', error)
    }
  })()

  await bootstrapPromise
}
