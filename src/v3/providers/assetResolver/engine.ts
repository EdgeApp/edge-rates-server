import { assetResolverActive, config } from '../../../config'
import { postSlackText } from '../../../utils/postToSlack'
import { dateOnly } from '../../../utils/utils'
import type { RateEngine } from '../../types'
import { maxDrainedAssets } from './constants'
import { loadClassifierContext, loadIgnoreMap } from './docs'
import {
  classReportSections,
  formatReport,
  selectReportedAssets
} from './report'
import {
  claimDailyRun,
  drainUnresolvedAssets,
  finishDrain,
  releaseDailyRun
} from './store'

const ignoreFooter =
  'Silence an entry: add "pluginId_tokenId": { "reason": "...", "until": "YYYY-MM-DD" } to rates_settings/assetResolver'

/**
 * Drains the recorded assets, reports them, and forgets them.
 * Returns the posted text, for the CLI and for logs.
 */
export const runDailyReport = async (
  rightNow: Date
): Promise<string | undefined> => {
  const day = dateOnly(rightNow.toISOString())
  const counts = await drainUnresolvedAssets(maxDrainedAssets)
  const [context, { ignore, warning }] = await Promise.all([
    loadClassifierContext(),
    loadIgnoreMap()
  ])

  const selection = selectReportedAssets(counts, {
    context,
    ignore,
    rightNow,
    topN: config.assetResolver.reportTopN
  })
  const footer = warning == null ? [ignoreFooter] : [warning, ignoreFooter]
  const text = formatReport({
    day,
    selection,
    sections: classReportSections(selection.entries),
    footer
  })

  if (text != null) {
    console.log(text)
    const webhookUrl =
      config.assetResolver.slackWebhookUrl !== ''
        ? config.assetResolver.slackWebhookUrl
        : config.slackWebhookUrl
    if (webhookUrl !== '') await postSlackText(webhookUrl, text)
  }
  await finishDrain()
  return text
}

/** Hourly tick that runs the report once per UTC day, after the configured hour. */
export const dailyEngine: RateEngine = async () => {
  if (!assetResolverActive) return
  const rightNow = new Date()
  if (rightNow.getUTCHours() < config.assetResolver.runAfterUtcHour) return

  const day = dateOnly(rightNow.toISOString())
  if (!(await claimDailyRun(day, rightNow))) return
  try {
    await runDailyReport(rightNow)
  } catch (error: unknown) {
    await releaseDailyRun(day)
    throw error
  }
}
