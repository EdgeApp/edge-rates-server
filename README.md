# edge-rates-server

> A REST API for retrieving and storing historical crypto and fiat exchange rates.

# Setup

This project will automatically create & manage the required databases inside of CouchDb, assuming it has access.

### Installation

#### Install Yarn

    https://linuxize.com/post/how-to-install-yarn-on-ubuntu-18-04/

#### Install Node

    curl -sL https://deb.nodesource.com/setup_10.x -o nodesource_setup.sh
    sudo bash nodesource_setup.sh

#### Run Yarn

    yarn

Install and run CouchDB v3.1 (use apt install process for Ubuntu 18.04)

    https://docs.couchdb.org/en/3.1.0/install/index.html

#### Launch API server

    node lib/index.js

## Manage server using `pm2`

    First, install pm2 to run at startup:

    yarn global add pm2
    pm2 startup # Then do what it says

    Next, tell pm2 how to run the server script:

    # install:
    pm2 start pm2.json
    pm2 save

    # check status:
    pm2 monit
    tail -f /var/log/ratesServer.log

#### Restart, stop, delete service

    pm2 restart ratesServer
    pm2 reload ratesServer
    pm2 stop ratesServer
    pm2 delete ratesServer

### Terminate SSL using Caddy

Please see our [Caddy setup documentation](./docs/caddySetup.md) for details.
