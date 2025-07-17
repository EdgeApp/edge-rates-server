import nano from 'nano'

import { config } from '../config'

async function main(): Promise<void> {
  const db = nano(config.couchUri).use('db_rates')
  const BATCH_SIZE = 1000

  try {
    let bookmark: string | undefined
    let totalProcessed = 0

    while (true) {
      const result = await db.find({
        selector: {
          _id: {
            $gte: '2025-01-14T00:00:00.000Z',
            $lt: '2025-01-16T19:48:58.038Z'
          }
        },
        limit: BATCH_SIZE,
        bookmark
      })

      if (result.docs.length === 0) break

      console.log(`Processing batch of ${result.docs.length} documents`)

      for (const doc of result.docs) {
        try {
          // await db.destroy(doc._id, doc._rev)
          console.log(`Deleted document ${doc._id}`)
        } catch (err) {
          console.error(`Failed to delete document ${doc._id}:`, err)
        }
      }

      totalProcessed += result.docs.length
      bookmark = result.bookmark
      console.log(`Processed ${totalProcessed} documents total`)
    }

    console.log(`Finished deleting ${totalProcessed} documents`)
  } catch (err) {
    console.error('Error:', err)
    process.exit(1)
  }
}

main().catch(console.error)
