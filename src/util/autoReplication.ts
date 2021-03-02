import nano from 'nano'
import fetch from 'node-fetch'

import config from '../../serverConfig.json'

export async function autoReplication(
  infoServerAddress: string,
  serverName: string,
  apiKey: string
): Promise<void> {
  const uri = `https://${infoServerAddress}/v1/edgeServersInternal/${serverName}s?apiKey=${apiKey}`
  try {
    const result = await fetch(uri, {
      method: 'GET'
    })
    const resultObj = await result.json()
    for (const cluster of resultObj.clusters) {
      for (const serverUri in cluster.servers) {
        if (
          typeof cluster.servers[serverUri].username === 'string' &&
          typeof cluster.servers[serverUri].password === 'string'
        ) {
          console.log(
            `Username and Password for server ${serverUri} exists, attempting replication between servers.`
          )
          const username: string = cluster.servers[serverUri].username
          const password: string = cluster.servers[serverUri].password
          const sourceUri = `https://${username}:${password}@${serverUri}:6984`
          const destinationUri = config.dbFullpath
          const existingDbsUri = `${sourceUri}/_all_dbs`
          let finalDbList
          try {
            const existingDbsQuery = await fetch(existingDbsUri, {
              method: 'GET'
            })
            const existingDbs = existingDbsQuery.json()
            finalDbList = existingDbs.filter(
              dbName => dbName !== '_users' || dbName !== '_replicator'
            )
          } catch {
            console.log(
              `Could not get list of existing dbs for ${serverUri}, continuing other replications`
            )
            continue
          }
          for (const db of finalDbList) {
            await dbReplication(sourceUri, db, destinationUri, db, true)
          }
        } else {
          console.log(
            `Username and Password for server ${serverUri} does not exist, cannot attempt replication.`
          )
        }
      }
    }
  } catch {
    console.log('Replication between servers failed.')
  }
}

// Uri should be of form `https://${username}:${password}@${website_name}:6984`
export async function dbReplication(
  sourceUri: string,
  sourceDb: string,
  destinationUri: string,
  destinationDb: string,
  isContinuous: boolean
): Promise<void> {
  const connection = nano(sourceUri)
  try {
    const response = await connection.db.replication.enable(
      sourceDb,
      `${destinationUri}/${destinationDb}`,
      { create_target: true, continuous: isContinuous }
    )
    if (response.ok === true) {
      console.log(
        `Replication started successfully for ${destinationDb} at ${destinationUri}`
      )
    }
  } catch (e) {
    console.log(
      `Replication failed to start for ${destinationDb} at ${destinationUri}`
    )
    console.log(e)
  }
}
