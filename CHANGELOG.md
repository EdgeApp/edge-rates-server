# edge-rates-server

## Unreleased

- fixed: Non-USD coinrank rate requests were intermittently returning USD results
- fixed: `coinrank?fiatCode=iso:[fiatCode]` was not calculating fiat exchange rates for all relevant fields

## 0.2.0 (2024-04-16)

- added: Run engines at configurable intervals and minute offset
