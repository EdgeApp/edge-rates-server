# edge-rates-server

## Unreleased

- added: Add script to wipe out provider rates from docs
- added: Robinhood Chain exchange rate support
- fixed: Fall back to the bundled currency code map when the v2 currency code map has not synced from CouchDB, instead of answering every v2 rate with null and a 200 status
- fixed: Alert on Slack when the v2 currency code map has never synced, while keeping the heartbeat healthy so a CouchDB outage does not pull every instance from the load balancer
- fixed: Retry synced documents that fail their initial load on a five second to five minute backoff, rather than waiting for the 30 minute refresh interval
- fixed: Log the reason each synced document fails to load during bootstrap
- fixed: Seed the `v2CurrencyCodeMap` document in the shape its cleaner expects, so running the database setup no longer overwrites it with a document that reads as an empty map

## 3.1.0 (2025-10-25)

- added: v2 api wrapper around v3 endpoints

## 3.0.0

- added: New v3 api

## 2.0.0

- added: Foolproof deployment scripts with yarn commands for consistent PM2 operations
- fixed: Eliminated Redis race condition causing intermittent empty responses from Redis-dependent endpoints
- fixed: Implemented atomic Redis updates using temporary keys and rename operations
- fixed: Added environment variable guard to prevent multi-instance sync conflicts
- fixed: Configured PM2 for single instance deployment to prevent process conflicts
- fixed: Non-USD coinrank rate requests were intermittently returning USD results
- fixed: `coinrank?fiatCode=iso:[fiatCode]` was not calculating fiat exchange rates for all relevant fields

## 0.2.0 (2024-04-16)

- added: Run engines at configurable intervals and minute offset
