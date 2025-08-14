import { asObject, CleanerShape } from 'cleaners'
import express from 'express'

export const asExtendedReq =
  <T>(asExtension: CleanerShape<T>) =>
  (raw: any): express.Request & T => {
    const extension = asObject(asExtension)(raw)
    Object.assign(raw, extension)
    return raw
  }
