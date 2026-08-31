import { type SyncedDocument, watchDatabase } from 'edge-server-tools'

import { FIVE_MINUTES, FIVE_SECONDS } from './constants'
import { coingeckoSyncedDocuments } from './providers/coingecko/coingecko'
import { coinmarketcapSyncedDocuments } from './providers/coinmarketcap/coinmarketcap'
import { constantRatesSyncedDocuments } from './providers/constantRates'
import { dbSettings } from './providers/couch'
import { hasV2CurrencyCodeMapSynced, routerSyncedDocuments } from './router'
import { create30MinuteSyncInterval, retrySyncUntilLoaded } from './utils'

export const v3SyncedDocuments: Array<SyncedDocument<unknown>> = [
  ...routerSyncedDocuments,
  ...coingeckoSyncedDocuments,
  ...coinmarketcapSyncedDocuments,
  ...constantRatesSyncedDocuments
]

// Most synced documents are allowed to be empty, so a resolved sync is enough
// to consider them loaded. The v2 currency code map is not: an empty map sends
// every v2 conversion to the bundled fallback.
const isLoadedByDocId: Record<string, () => boolean> = {
  v2CurrencyCodeMap: hasV2CurrencyCodeMapSynced
}

/**
 * Whether nano has given up on the changes feed rather than retrying it.
 *
 * Its reader stops for good on a 4xx other than 429, and then resets itself
 * with a fresh event emitter, so the handlers `watchDatabase` registered are
 * discarded and nothing re-arms. Every other failure, including the
 * ECONNREFUSED of a CouchDB that is restarting, it retries on its own backoff.
 */
const isFatalWatcherError = (error: unknown): boolean => {
  const { statusCode } = (error ?? {}) as { statusCode?: unknown }
  return (
    typeof statusCode === 'number' &&
    statusCode >= 400 &&
    statusCode < 500 &&
    statusCode !== 429
  )
}

/**
 * Watch `rates_settings` for synced document changes, restarting the feed if
 * nano stops retrying it.
 *
 * `watchDatabase` starts the changes feed before it awaits an initial sync of
 * every document, so a rejection means that sync failed rather than the feed
 * failing to start. The documents are already covered by the bootstrap retry
 * above, and the feed reconnects on its own, so that case only gets a log.
 */
const startSyncedDocWatcher = (): void => {
  let delay = FIVE_SECONDS
  let restartPending = false

  const attempt = (): void => {
    watchDatabase(dbSettings, {
      syncedDocuments: v3SyncedDocuments,
      onError: (error: unknown) => {
        console.error('rates_settings watcher error', error)
        if (!isFatalWatcherError(error) || restartPending) return

        restartPending = true
        setTimeout(() => {
          restartPending = false
          attempt()
        }, delay)
        delay = Math.min(delay * 2, FIVE_MINUTES)
      }
    }).then(
      () => {
        delay = FIVE_SECONDS
        console.log('Watching rates_settings for synced doc changes')
      },
      (error: unknown) => {
        console.error(
          'rates_settings watcher initial sync failed, feed still connecting',
          error
        )
      }
    )
  }

  attempt()
}

let bootstrapPromise: Promise<void> | undefined

export const bootstrapV3SyncedDocs = async (): Promise<void> => {
  bootstrapPromise ??= (async () => {
    console.log('Starting v3 synced doc bootstrap')

    const syncResults = await Promise.allSettled(
      v3SyncedDocuments.map(async syncedDocument => {
        await syncedDocument.sync(dbSettings)
      })
    )
    const failedDocs = syncResults.flatMap((result, index) =>
      result.status === 'rejected'
        ? [{ syncedDocument: v3SyncedDocuments[index], reason: result.reason }]
        : []
    )

    if (failedDocs.length > 0) {
      // Log each reason. Without it the cause of an empty document, usually
      // CouchDB refusing connections while it restarts, never reaches the logs:
      for (const { syncedDocument, reason } of failedDocs) {
        console.error(
          'Initial v3 synced doc load failed',
          syncedDocument.id,
          reason
        )
      }
      console.error(
        `Initial v3 synced doc load completed with ${
          failedDocs.length
        } failure(s): ${failedDocs
          .map(({ syncedDocument }) => syncedDocument.id)
          .join(', ')}`
      )

      // Recover in seconds rather than waiting for the 30 minute interval:
      for (const { syncedDocument } of failedDocs) {
        retrySyncUntilLoaded(
          syncedDocument,
          dbSettings,
          isLoadedByDocId[syncedDocument.id]
        )
      }
    } else {
      console.log('Initial v3 synced doc load complete')
    }

    for (const syncedDocument of v3SyncedDocuments) {
      create30MinuteSyncInterval(syncedDocument, dbSettings)
    }

    startSyncedDocWatcher()
  })()

  await bootstrapPromise
}
