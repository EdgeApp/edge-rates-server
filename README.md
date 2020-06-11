# edge-rates-server

> A REST API for retrieving and storing historical crypto and fiat exchange rates.

#### Installation

Install Yarn

    https://linuxize.com/post/how-to-install-yarn-on-ubuntu-18-04/

Install Node

    curl -sL https://deb.nodesource.com/setup_10.x -o nodesource_setup.sh
    sudo bash nodesource_setup.sh

Run Yarn

    yarn

Install and run CouchDB v3.1 (use apt install process for Ubuntu 18.04)

    https://docs.couchdb.org/en/3.1.0/install/index.html

#### Launch API server

    node lib/index.js

#### Install forever-service

    sudo npm install -g forever

    sudo npm install -g forever-service

#### Install rates server using `forever-service`

    sudo forever-service install ratesServer -r [username] --script lib/index.js  --start

#### Restart, stop, delete service

    sudo service ratesServer restart
    sudo service ratesServer stop
    sudo forever-service delete ratesServer

### Terminate SSL using Caddy

Please see our [Caddy setup documentation](./docs/caddySetup.md) for details.
