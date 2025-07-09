# edge-rates-server

## Unreleased

- added: Foolproof deployment scripts with yarn commands for consistent PM2 operations
- fixed: Eliminated Redis race condition causing intermittent empty responses from Redis-dependent endpoints
- fixed: Implemented atomic Redis updates using temporary keys and rename operations
- fixed: Added environment variable guard to prevent multi-instance sync conflicts
- fixed: Configured PM2 for single instance deployment to prevent process conflicts
- fixed: Non-USD coinrank rate requests were intermittently returning USD results
- fixed: `coinrank?fiatCode=iso:[fiatCode]` was not calculating fiat exchange rates for all relevant fields

## 0.2.0 (2024-04-16)

- added: Run engines at configurable intervals and minute offset
