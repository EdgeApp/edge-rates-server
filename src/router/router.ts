import express, { Router } from 'express'

export const createRouter = (routes: { [path: string]: Router }): Router => {
  const router = express.Router()

  for (const path of Object.keys(routes)) {
    router.use(path, routes[path])
  }

  return router
}
