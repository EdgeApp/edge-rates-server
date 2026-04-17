import type { SyncedDocumentOptions } from 'edge-server-tools'

import { slackPoster } from '../utils/postToSlack'

const toErrorText = (error: unknown): string => {
  if (error instanceof Error) return error.message
  return String(error)
}

export const makeSyncedDocumentOptions = (
  docId: string,
  cleanerName: string
): SyncedDocumentOptions => ({
  cleanFailStrategy: 'preserve',
  onCleanFail: (error: unknown) => {
    const message =
      `rates_settings cleaner failed for ${docId} (${cleanerName}): ` +
      toErrorText(error)
    slackPoster(message).catch((slackError: unknown) => {
      console.error(
        'Failed to report synced document cleaner error',
        docId,
        slackError
      )
    })
  }
})
