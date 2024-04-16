import { makeConfig } from 'cleaner-config'
import { asArray, asNumber, asObject, asOptional, asString } from 'cleaners'

// Customization:

const {
  COUCH_HOSTNAME = 'localhost',
  COUCH_PASSWORD = 'password',
  INFO_SERVER_ADDRESS = 'info1.edge.app',
  INFO_SERVER_API_KEY = '',
  RATES_SERVER_ADDRESS = 'http://127.0.0.1:8087',
  CURRENCY_CONVERTER_API_KEY = '',
  COIN_GECKO_API_KEY = '',
  COIN_MARKET_CAP_API_KEY = '',
  COIN_MARKET_CAP_HISTORICAL_API_KEY = '',
  SLACK_WEBHOOK_URL = '',
  OPEN_EXCHANGE_RATES_API_KEY = '',
  DEFAULT_FIAT = 'iso:USD'
} = process.env

const providerDefaults = {
  coincap: {
    uri: 'https://api.coincap.io'
  },
  currencyConverter: {
    uri: 'https://api.currconv.com',
    apiKey: CURRENCY_CONVERTER_API_KEY
  },
  coinMarketCapCurrent: {
    uri: 'https://pro-api.coinmarketcap.com',
    apiKey: COIN_MARKET_CAP_API_KEY
  },
  coinMarketCapHistorical: {
    uri: 'https://pro-api.coinmarketcap.com',
    apiKey: COIN_MARKET_CAP_HISTORICAL_API_KEY
  },
  openExchangeRates: {
    uri: 'https://openexchangerates.org',
    apiKey: OPEN_EXCHANGE_RATES_API_KEY
  },
  coinstore: {
    uri: 'https://api.coinstore.com'
  },
  coingecko: {
    uri: 'https://api.coingecko.com'
  },
  coingeckopro: {
    uri: 'https://pro-api.coingecko.com',
    apiKey: COIN_GECKO_API_KEY
  },
  compound: {
    uri: 'https://api.compound.finance'
  },
  wazirx: {
    uri: 'https://api.wazirx.com'
  },
  coinmonitor: {
    uri: 'http://ar.coinmonitor.info'
  }
}

// Config:

export const asConfig = asObject({
  couchUri: asOptional(
    asString,
    `http://admin:${COUCH_PASSWORD}@${COUCH_HOSTNAME}:5984`
  ),
  httpPort: asOptional(asNumber, 8008),
  httpHost: asOptional(asString, '127.0.0.1'),
  infoServerAddress: asOptional(asString, INFO_SERVER_ADDRESS),
  infoServerApiKey: asOptional(asString, INFO_SERVER_API_KEY),
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
  ratesServerAddress: asOptional(asString, RATES_SERVER_ADDRESS),
  slackWebhookUrl: asOptional(asString, SLACK_WEBHOOK_URL),
  providers: asOptional(
    asObject({
      coincap: asObject({
        uri: asString
      }),
      currencyConverter: asObject({
        uri: asString,
        apiKey: asString
      }),
      coinMarketCapCurrent: asObject({
        uri: asString,
        apiKey: asString
      }),
      coinMarketCapHistorical: asObject({
        uri: asString,
        apiKey: asString
      }),
      openExchangeRates: asObject({
        uri: asString,
        apiKey: asString
      }),
      coinstore: asObject({
        uri: asString
      }),
      coingecko: asObject({
        uri: asString
      }),
      coingeckopro: asObject({
        uri: asString,
        apiKey: asString
      }),
      compound: asObject({
        uri: asString
      }),
      wazirx: asObject({
        uri: asString
      }),
      coinmonitor: asObject({
        uri: asString
      })
    }),
    providerDefaults
  ),
  preferredCryptoFiatPairs: asOptional(asArray(asString), [
    'BTC_iso:ARS',
    'BTC_iso:INR'
  ]),
  defaultFiatCode: asOptional(asString, DEFAULT_FIAT),

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
