import express, { type Router } from 'express'

export const createRouter = (routes: Record<string, Router>): Router => {
  const router = express.Router()

  for (const path of Object.keys(routes)) {
    router.use(path, routes[path])
  }

  return router
}
