import { Cleaner } from 'cleaners'

import {
  ErrorType,
  Processor,
  ProcessorResponse,
  ServerError,
  ServerState
} from '../types/types'
import { mergeDocuments } from './utils'

export const serverError = <T>(
  params: T,
  message: string,
  errorType: ErrorType = 'server_error',
  errorCode: number = 500
): ServerError & T & Error =>
  Object.assign(new Error(message), {
    errorCode,
    errorType,
    message,
    ...params
  })

export const fromCleaner = async <T>(
  cleaner: Cleaner<T>,
  params: T
): Promise<ProcessorResponse<T>> =>
  await Promise.resolve(cleaner(params))
    .then(result => ({ result }))
    .catch(e => ({
      error: serverError(params, e.message, 'bad_query', 400)
    }))

export const fromSave = async <T, D>(
  save: (state: ServerState<D>) => Promise<void> | void,
  _params: T,
  state: ServerState<D> = {}
): Promise<ProcessorResponse<undefined, D>> => {
  Promise.resolve(save(state)).catch(() => null)
  return { state }
}

export const fromLoad = async <T, D>(
  load: (params: T) => Promise<ServerState<D>>,
  params: T
): Promise<ProcessorResponse<undefined, D>> =>
  await load(params)
    .then(state => ({ state }))
    .catch(e => ({ error: serverError(params, e.message, 'db_error') }))

// export const fromSlack = async <T>(
//   slack: (message: string) => Promise<void>,
//   error: ServerError
// ): Promise<ProcessorResponse<T>> => {
//   if (error?.errorCode === 500) slack(error.message).catch(e => e)
//   return { error }
// }

export const toParallel = async <T, D, R>(
  processors: Processor<T, D, R> | Array<Processor<T, D, R>>,
  params: T,
  state: ServerState<D> = {}
): Promise<ProcessorResponse<R, D>> => {
  // If 'processors' is a single funtion and not an array, execute it and return result
  if (!Array.isArray(processors))
    return await Promise.resolve(processors(params, state)).catch(error => ({
      error
    }))
  // Create a recursive promise array for all the processor in the 'processors' array
  const responses = await Promise.all(
    processors.map(
      async processor => await toParallel(processor, params, state)
    )
  )
  // Reduce the results from all the promise executions into one
  return responses.reduce(
    (response: ProcessorResponse<R, D>, { state = {}, result, error }) => ({
      // Add the single result (res) to the results array
      result: [...(response.result as R[]), (result as R) ?? { error }],
      // Merge all the documents that was returned from all the parallel processors
      state:
        response.state != null ? mergeDocuments(response.state, state) : state
    }),
    { state, result: [] }
  )
}

export const toWaterfall = async <T, D, R>(
  processors: Processor<T, D, R> | Array<Processor<T, D, R>>,
  params: T,
  state: ServerState<D> = {}
): Promise<ProcessorResponse<R, D>> => {
  const response: Partial<ProcessorResponse<R, D>> = { state }
  // If there is only one processor wrap it in an array
  processors = Array.isArray(processors) ? processors : [processors]
  // If there are no processors left, return only the documents
  if (processors.length === 0) return response
  // Get the first processor in the array
  const [processor, ...rest] = processors

  try {
    // Call the first processor
    const { result, error, state: newState } = await processor(params, state)
    // Set the response documents to whatever the processor returns
    response.state = newState
    // If the processor didn't give a result or it gave an error, throw the error
    if (result == null || error != null) throw error
    // Set the result on the response
    return { ...response, result }
  } catch (e) {
    // If there are no more processors to try, return an error
    if (rest?.length <= 0) return { error: e, state }
    // Merge the documents that was returned from the processor with the current state
    const mergedDocs = mergeDocuments(state, response.state ?? {})
    // Call the recursion with the rest of the processors
    return await toWaterfall(rest, params, mergedDocs)
  }
}
