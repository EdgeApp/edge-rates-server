export const clean = cleaner => (req, res, next) => {
  try {
    if (Array.isArray(req.body)) {
      req.params = cleaner(req.body)
    } else {
      req.params = cleaner({
        ...(req.query ?? {}),
        ...(req.body ?? {})
      })
    }
    return next()
  } catch (e) {
    return next({
      message: e.message,
      errorType: 'bad_query',
      errorCode: 400
    })
  }
}
