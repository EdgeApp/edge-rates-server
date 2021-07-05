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
  COIN_MARKET_CAP_API_KEY = '',
  COIN_MARKET_CAP_HISTORICAL_API_KEY = '',
  SLACK_WEBHOOK_URL = '',
  OPEN_EXCHANGE_RATES_API_KEY,
  NOMICS_API_KEY,
  DEFAULT_FIAT = 'iso:USD'
} = process.env

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
  bridgeCurrencies: asOptional(asArray(asString), ['iso:USD', 'BTC']),
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
  providers: asObject({
    coincap: asObject({
      uri: asOptional(asString, 'https://api.coincap.io')
    }),
    currencyConverter: asObject({
      uri: asOptional(asString, 'https://api.currconv.com'),
      apiKey: asOptional(asString, CURRENCY_CONVERTER_API_KEY)
    }),
    coinMarketCapCurrent: asObject({
      uri: asOptional(asString, 'https://pro-api.coinmarketcap.com'),
      apiKey: asOptional(asString, COIN_MARKET_CAP_API_KEY)
    }),
    coinMarketCapHistorical: asObject({
      uri: asOptional(asString, 'https://pro-api.coinmarketcap.com'),
      apiKey: asOptional(asString, COIN_MARKET_CAP_HISTORICAL_API_KEY)
    }),
    openExchangeRates: asObject({
      uri: asOptional(asString, 'https://openexchangerates.org'),
      apiKey: asOptional(asString, OPEN_EXCHANGE_RATES_API_KEY)
    }),
    nomics: asObject({
      uri: asOptional(asString, 'https://api.nomics.com'),
      apiKey: asOptional(asString, NOMICS_API_KEY)
    }),
    compound: asObject({
      uri: asOptional(asString, 'https://api.compound.finance')
    })
  }),
  defaultFiatCode: asOptional(asString, DEFAULT_FIAT),
  ratesLookbackLimit: asOptional(asNumber, 604800000)
})

export const config = makeConfig(asConfig, 'serverConfig.json')
