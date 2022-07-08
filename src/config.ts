import { makeConfig } from 'cleaner-config'
import { asArray, asNumber, asObject, asOptional, asString } from 'cleaners'

import { asHealingObject } from './utils/asHealingObject'

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
  providers: asHealingObject(
    {
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
      nomics: asObject({
        uri: asString,
        apiKey: asString
      }),
      coingecko: asObject({
        uri: asString
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
    },
    {
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
      nomics: {
        uri: 'https://api.nomics.com',
        apiKey: NOMICS_API_KEY
      },
      coingecko: {
        uri: 'https://api.coingecko.com'
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
  ),
  preferredCryptoFiatPairs: asOptional(asArray(asString), [
    'BTC_iso:ARS',
    'BTC_iso:INR'
  ]),
  defaultFiatCode: asOptional(asString, DEFAULT_FIAT),
  ratesLookbackLimit: asOptional(asNumber, 604800000)
})

export const config = makeConfig(asConfig, 'serverConfig.json')
