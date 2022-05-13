# edge-rates-server

> A REST API for retrieving and storing historical crypto and fiat exchange rates.

#### Installation

Install Yarn

    https://linuxize.com/post/how-to-install-yarn-on-ubuntu-18-04/

Install Node

    curl -sL https://deb.nodesource.com/setup_10.x -o nodesource_setup.sh
    sudo bash nodesource_setup.sh

Install and run CouchDB v3.1 (use apt install process for Ubuntu 18.04)

    https://docs.couchdb.org/en/3.1.0/install/index.html

Install and start Redis

    https://redis.io/docs/getting-started/installation/install-redis-on-linux/#install-on-ubuntu

    redis-server

Install pm2 globally

    npm install pm2 -g

Install pm2 log rotation (note: the command is pm2 instead of npm)

    pm2 install pm2-logrotate

Run Yarn

    yarn && yarn prepare

#### Running Source

    yarn start
    yarn startEngines

#### Launch API server and rates engine for production

    pm2 start pm2.json

#### Restart, stop, delete service

Control pm2

    pm2 stop     <ratesServer|ratesEngine|'all'>
    pm2 restart  <ratesServer|ratesEngine|'all'>
    pm2 delete   <ratesServer|ratesEngine|'all'>

Launch pm2 on restart

    pm2 startup
    pm2 save

#### Monitor logs and status

    pm2 monit
    pm2 logs <ratesServer|ratesEngine|'all'>

### Terminate SSL using Caddy

Please see our [Caddy setup documentation](./docs/caddySetup.md) for details.
