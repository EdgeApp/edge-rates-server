# edge-rates-server

> A REST API for retrieving and storing historical exchange rates.

#### Installation

    yarn

Install and run CouchDB v3.1
https://docs.couchdb.org/en/3.1.0/install/index.html

Use apt install process for Ubuntu 18.04

Use runit for installation as daemon

#### Launch API server

    node lib/index.js

#### Install rates server using `forever-service`

    sudo forever-service install ratesServer -r [username] --script lib/index.js  --start

#### Restart, stop, delete service

    sudo service ratesServer restart
    sudo service ratesServer stop
    sudo forever-service delete ratesServer

### Terminate SSL using Caddy

Please see our [Caddy setup documentation](./docs/caddySetup.md) for details.
