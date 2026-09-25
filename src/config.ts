import { makeConfig } from 'cleaner-config'
import {
  asArray,
  asMaybe,
  asNumber,
  asObject,
  asOptional,
  asString
} from 'cleaners'

// Customization:

const {
  COUCH_HOSTNAME: couchHostname = 'localhost',
  COUCH_PASSWORD: couchPassword = 'password',
  INFO_SERVER_ADDRESS: infoServerAddress = 'info1.edge.app',
  INFO_SERVER_API_KEY: infoServerApiKey = '',
  RATES_SERVER_ADDRESS: ratesServerAddress = 'http://127.0.0.1:8087',
  CURRENCY_CONVERTER_API_KEY: currencyConverterApiKey = '',
  COIN_GECKO_API_KEY: coinGeckoApiKey = '',
  COIN_MARKET_CAP_API_KEY: coinMarketCapApiKey = '',
  COIN_MARKET_CAP_HISTORICAL_API_KEY: coinMarketCapHistoricalApiKey = '',
  COIN_MARKET_CAP_HISTORICAL_MAX_MONTHS:
    coinMarketCapHistoricalMaxMonths = '60',
  SLACK_WEBHOOK_URL: slackWebhookUrl = '',
  OPEN_EXCHANGE_RATES_API_KEY: openExchangeRatesApiKey = '',
  DEFAULT_FIAT: defaultFiat = 'iso:USD',
  CURSOR_API_KEY: cursorApiKey = '',
  ASSET_RESOLVER_SLACK_WEBHOOK_URL: assetResolverSlackWebhookUrl = '',
  TYPESAFE_API_KEY: typesafeApiKey = ''
} = process.env

const providerDefaults = {
  coincap: {
    uri: 'https://api.coincap.io'
  },
  currencyConverter: {
    uri: 'https://api.currconv.com',
    apiKey: currencyConverterApiKey
  },
  coinMarketCapCurrent: {
    uri: 'https://pro-api.coinmarketcap.com',
    apiKey: coinMarketCapApiKey
  },
  coinMarketCapHistorical: {
    uri: 'https://pro-api.coinmarketcap.com',
    apiKey: coinMarketCapHistoricalApiKey,
    maxHistoricalMonths: Number(coinMarketCapHistoricalMaxMonths)
  },
  openExchangeRates: {
    uri: 'https://openexchangerates.org',
    apiKey: openExchangeRatesApiKey
  },
  coinstore: {
    uri: 'https://api.coinstore.com'
  },
  coingecko: {
    uri: 'https://api.coingecko.com'
  },
  coingeckopro: {
    uri: 'https://pro-api.coingecko.com',
    apiKey: coinGeckoApiKey
  },
  compound: {
    uri: 'https://api.compound.finance'
  },
  wazirx: {
    uri: 'https://api.wazirx.com'
  },
  midgard: {
    uri: 'https://midgard.ninerealms.com'
  },
  coinmonitor: {
    uri: 'http://ar.coinmonitor.info'
  }
}

const assetResolverDefaults = {
  cursorApiKey,
  // The daily engine runs after this UTC hour, once the 15:00 restart and the
  // CoinGecko sweep are done:
  runAfterUtcHour: 16,
  reportTopN: 50,
  // Empty falls back to the global slackWebhookUrl:
  slackWebhookUrl: assetResolverSlackWebhookUrl,
  agent: {
    // The Cursor CLI binary, or another agent that accepts its flags:
    command: 'agent',
    // Empty uses the CLI's default model:
    model: '',
    runRoot: '~/.edge-rates/assetResolver/runs',
    timeoutSeconds: 1800,
    maxAssetsPerBatch: 25
  },
  judge: {
    // Where the confidence of an agent verdict comes from: 'agent' or 'jev'
    kind: 'agent',
    // A second judge whose probability is stored without gating: 'none', 'agent', or 'jev'
    shadow: 'none',
    typesafeApiKey,
    jevModel: 'jev-latest'
  }
}

// Config:

export const asConfig = asObject({
  couchUri: asOptional(
    asString,
    `http://admin:${couchPassword}@${couchHostname}:5984`
  ),
  httpPort: asOptional(asNumber, 8008),
  httpHost: asOptional(asString, '127.0.0.1'),
  infoServerAddress: asOptional(asString, infoServerAddress),
  infoServerApiKey: asOptional(asString, infoServerApiKey),
  bridgeCurrencies: asOptional(asArray(asString), ['iso:USD', 'BTC', 'USDT']),
  cryptoCurrencyCodes: asOptional(asArray(asString), [
    'BTC',
    'ETH',
    'USDT',
    'XRP',
    'DOT',
    'ADA',
    'LINK',
    'LTC',
    'BNB',
    'BCH',
    'XLM',
    'DOGE',
    'USDC',
    'UNI',
    'AAVE',
    'WBTC',
    'BSV',
    'EOS',
    'XMR',
    'XEM',
    'TRX',
    'SNX',
    'XTZ',
    'COMP',
    'THETA',
    'MKR',
    'SUSHI',
    'ATOM',
    'UMA',
    'VET'
  ]),
  fiatCurrencyCodes: asOptional(asArray(asString), [
    'iso:EUR',
    'iso:CNY',
    'iso:JPY',
    'iso:GBP'
  ]),
  ratesServerAddress: asOptional(asString, ratesServerAddress),
  slackWebhookUrl: asOptional(asString, slackWebhookUrl),
  assetResolver: asOptional(
    asObject({
      // A Cursor API key activates the asset resolver on this box:
      cursorApiKey: asOptional(asString, assetResolverDefaults.cursorApiKey),
      runAfterUtcHour: asOptional(
        asNumber,
        assetResolverDefaults.runAfterUtcHour
      ),
      reportTopN: asOptional(asNumber, assetResolverDefaults.reportTopN),
      slackWebhookUrl: asOptional(
        asString,
        assetResolverDefaults.slackWebhookUrl
      ),
      agent: asOptional(
        asObject({
          command: asOptional(asString, assetResolverDefaults.agent.command),
          model: asOptional(asString, assetResolverDefaults.agent.model),
          runRoot: asOptional(asString, assetResolverDefaults.agent.runRoot),
          timeoutSeconds: asOptional(
            asNumber,
            assetResolverDefaults.agent.timeoutSeconds
          ),
          maxAssetsPerBatch: asOptional(
            asNumber,
            assetResolverDefaults.agent.maxAssetsPerBatch
          )
        }),
        assetResolverDefaults.agent
      ),
      judge: asOptional(
        asObject({
          kind: asOptional(asString, assetResolverDefaults.judge.kind),
          shadow: asOptional(asString, assetResolverDefaults.judge.shadow),
          typesafeApiKey: asOptional(
            asString,
            assetResolverDefaults.judge.typesafeApiKey
          ),
          jevModel: asOptional(asString, assetResolverDefaults.judge.jevModel)
        }),
        assetResolverDefaults.judge
      )
    }),
    assetResolverDefaults
  ),
  providers: asMaybe(
    asObject({
      coincap: asMaybe(
        asObject({
          uri: asString
        }),
        providerDefaults.coincap
      ),
      currencyConverter: asMaybe(
        asObject({
          uri: asString,
          apiKey: asString
        }),
        providerDefaults.currencyConverter
      ),
      coinMarketCapCurrent: asMaybe(
        asObject({
          uri: asString,
          apiKey: asString
        }),
        providerDefaults.coinMarketCapCurrent
      ),
      coinMarketCapHistorical: asMaybe(
        asObject({
          uri: asString,
          apiKey: asString,
          maxHistoricalMonths: asOptional(asNumber, 60)
        }),
        providerDefaults.coinMarketCapHistorical
      ),
      openExchangeRates: asMaybe(
        asObject({
          uri: asString,
          apiKey: asString
        }),
        providerDefaults.openExchangeRates
      ),
      coinstore: asMaybe(
        asObject({
          uri: asString
        }),
        providerDefaults.coinstore
      ),
      coingecko: asMaybe(
        asObject({
          uri: asString
        }),
        providerDefaults.coingecko
      ),
      coingeckopro: asMaybe(
        asObject({
          uri: asString,
          apiKey: asString
        }),
        providerDefaults.coingeckopro
      ),
      compound: asMaybe(
        asObject({
          uri: asString
        }),
        providerDefaults.compound
      ),
      wazirx: asMaybe(
        asObject({
          uri: asString
        }),
        providerDefaults.wazirx
      ),
      midgard: asMaybe(
        asObject({
          uri: asString
        }),
        providerDefaults.midgard
      ),
      coinmonitor: asMaybe(
        asObject({
          uri: asString
        }),
        providerDefaults.coinmonitor
      )
    }),
    providerDefaults
  ),
  preferredCryptoFiatPairs: asOptional(asArray(asString), [
    'BTC_iso:ARS',
    'BTC_iso:INR'
  ]),
  defaultFiatCode: asOptional(asString, defaultFiat),

  /**
   * Run the engine every n seconds after the hour
   * and every n seconds of the hour
   * */
  coinrankIntervalSeconds: asOptional(asNumber, 120),
  ratesIntervalSeconds: asOptional(asNumber, 60),

  /** Offset the running of engine by n seconds */
  coinrankOffsetSeconds: asOptional(asNumber, 0),
  ratesOffsetSeconds: asOptional(asNumber, 0),

  ratesLookbackLimit: asOptional(asNumber, 604800000)
})

export const config = makeConfig(asConfig, 'serverConfig.json')

/**
 * The asset resolver runs only where a Cursor API key is configured, so one
 * box records, reports, and resolves while every other box stays inert.
 */
export const assetResolverActive: boolean =
  config.assetResolver.cursorApiKey !== ''
