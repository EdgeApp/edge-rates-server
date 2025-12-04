import { asMaybe, uncleaner } from 'cleaners'
import { asCouchDoc } from 'edge-server-tools'

import { dbData, dbSettings } from '../src/v3/providers/couch'
import { asRateDocument, asTokenMap } from '../src/v3/types'

/*
  This script will scrub the rates documents of any rate mapped in the uid document
*/

const mappingDocId = 'coingecko:automated'
const endTime = 1757289600000 // rates server PR merged september 8th 2025
const intervalMs = 1000 * 60 * 5 // five minutes

const isDebug = process.env.DEBUG === 'true' || process.env.DEBUG === '1'
const batchSize = isDebug ? 3 : 100

const asRatesDoc = asCouchDoc(asRateDocument)
const wasRatesDoc = uncleaner(asRatesDoc)

const main = async (): Promise<void> => {
  try {
    // Fetch mapping document
    const mappingDoc = await dbSettings.get(mappingDocId)
    const tokenMap = asCouchDoc(asTokenMap)(mappingDoc).doc
    const mappingKeys = new Set(Object.keys(tokenMap))

    console.log(`Found ${mappingKeys.size} keys in ${mappingDocId} document`)

    if (isDebug) {
      console.log(
        `DEBUG mode: Will collect ${batchSize} modified documents and print them, then exit without saving`
      )
    }

    let docTime = Math.floor(new Date().getTime() / intervalMs) * intervalMs
    const batch: Array<{ id: string; rev?: string; doc: any }> = []
    const debugInfoMap = new Map<
      string,
      {
        before: Record<string, { USD: number }>
        after: Record<string, { USD: number }>
        removedKeys: string[]
      }
    >()
    let processedCount = 0
    let modifiedCount = 0

    while (docTime > endTime) {
      const docId = new Date(docTime).toISOString()

      try {
        // Fetch document from rates_data database
        const rawDoc = await dbData.get(docId)
        const rateDoc = asMaybe(asRatesDoc)(rawDoc)

        if (rateDoc != null) {
          // Filter out keys that exist in the automated document
          const originalCryptoKeys = Object.keys(rateDoc.doc.crypto)
          const filteredCrypto: Record<string, { USD: number }> = {}
          const removedKeys: string[] = []

          for (const key of originalCryptoKeys) {
            if (!mappingKeys.has(key)) {
              filteredCrypto[key] = rateDoc.doc.crypto[key]
            } else {
              removedKeys.push(key)
            }
          }

          // Only add to batch if crypto object was modified
          if (
            originalCryptoKeys.length !== Object.keys(filteredCrypto).length
          ) {
            batch.push({
              id: rateDoc.id,
              rev: rateDoc.rev,
              doc: {
                crypto: filteredCrypto,
                fiat: rateDoc.doc.fiat
              }
            })

            // Store debug info separately if in debug mode
            if (isDebug) {
              debugInfoMap.set(rateDoc.id, {
                before: rateDoc.doc.crypto,
                after: filteredCrypto,
                removedKeys
              })
            }

            modifiedCount++

            // When batch reaches batchSize
            if (batch.length >= batchSize) {
              if (isDebug) {
                // Debug mode: print all documents in batch and exit
                console.log(
                  `\n=== DEBUG: Batch of ${batch.length} Modified Documents ===\n`
                )
                for (let i = 0; i < batch.length; i++) {
                  const item = batch[i]
                  const debugInfo = debugInfoMap.get(item.id)
                  if (debugInfo == null) continue

                  console.log(`\n--- Document ${i + 1}/${batch.length} ---`)
                  console.log(`Document ID: ${item.id}`)
                  console.log('\n--- BEFORE ---')
                  console.log(JSON.stringify(debugInfo.before, null, 2))
                  console.log('\n--- AFTER ---')
                  console.log(JSON.stringify(debugInfo.after, null, 2))
                  console.log('\n--- REMOVED KEYS ---')
                  console.log(JSON.stringify(debugInfo.removedKeys, null, 2))
                  console.log(
                    `Total keys before: ${Object.keys(debugInfo.before).length}`
                  )
                  console.log(
                    `Total keys after: ${Object.keys(debugInfo.after).length}`
                  )
                  console.log(`Keys removed: ${debugInfo.removedKeys.length}`)
                  if (i < batch.length - 1) {
                    console.log('\n' + '-'.repeat(50))
                  }
                }
                console.log('\n=====================================')
                console.log('\n--- ALL CHANGED DOCUMENT IDs ---')
                console.log(
                  JSON.stringify(batch.map(item => item.id).sort(), null, 2)
                )
                console.log(`\nTotal changed documents: ${batch.length}`)
                console.log('\n=====================================')
                console.log(
                  `DEBUG mode: Exiting after printing ${batch.length} documents - no changes saved`
                )
                return
              } else {
                // Normal mode: save to database
                await dbData.bulk({
                  docs: batch.map(wasRatesDoc)
                })
                processedCount += batch.length
                console.log(
                  `Processed ${processedCount} documents, ${modifiedCount} modified`
                )
                batch.length = 0 // Clear batch
              }
            }
          }
        }
      } catch (error: unknown) {
        // Skip missing documents silently
        if (
          error != null &&
          typeof error === 'object' &&
          'statusCode' in error &&
          error.statusCode !== 404
        ) {
          console.error(`Error processing document ${docId}:`, error)
        }
      }

      docTime = docTime - intervalMs
    }

    // Save any remaining documents in the batch (only in non-debug mode)
    if (batch.length > 0 && !isDebug) {
      await dbData.bulk({
        docs: batch.map(wasRatesDoc)
      })
      processedCount += batch.length
    } else if (batch.length > 0 && isDebug) {
      // In debug mode, print remaining documents if any
      console.log(
        `\n=== DEBUG: Remaining ${batch.length} Modified Documents ===\n`
      )
      for (let i = 0; i < batch.length; i++) {
        const item = batch[i]
        const debugInfo = debugInfoMap.get(item.id)
        if (debugInfo == null) continue

        console.log(`\n--- Document ${i + 1}/${batch.length} ---`)
        console.log(`Document ID: ${item.id}`)
        console.log('\n--- BEFORE ---')
        console.log(JSON.stringify(debugInfo.before, null, 2))
        console.log('\n--- AFTER ---')
        console.log(JSON.stringify(debugInfo.after, null, 2))
        console.log('\n--- REMOVED KEYS ---')
        console.log(JSON.stringify(debugInfo.removedKeys, null, 2))
        console.log(
          `Total keys before: ${Object.keys(debugInfo.before).length}`
        )
        console.log(`Total keys after: ${Object.keys(debugInfo.after).length}`)
        console.log(`Keys removed: ${debugInfo.removedKeys.length}`)
        if (i < batch.length - 1) {
          console.log('\n' + '-'.repeat(50))
        }
      }
      console.log('\n=====================================')
      console.log('\n--- ALL CHANGED DOCUMENT IDs ---')
      console.log(JSON.stringify(batch.map(item => item.id).sort(), null, 2))
      console.log(`\nTotal changed documents: ${batch.length}`)
      console.log('\n=====================================')
      console.log(
        `DEBUG mode: Exiting after printing ${batch.length} documents - no changes saved`
      )
    }

    console.log(
      `Completed: Processed ${processedCount} documents, ${modifiedCount} modified`
    )
  } catch (error: unknown) {
    console.error('Fatal error:', error)
    process.exit(1)
  }
}

main()
  .then(() => {
    console.log('Script completed successfully')
    process.exit(0)
  })
  .catch((error: unknown) => {
    console.error('Script failed:', error)
    process.exit(1)
  })
