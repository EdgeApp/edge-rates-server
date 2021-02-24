import {
  ParallelResult,
  ParallelResults,
  Processor,
  ProcessorParallelResults,
  ProcessorResponse,
  State
} from '../types/types'
import { mergeDocuments } from './utils'

export const processorParallel = async <T, D, R>(
  processors: Processor<R> | Array<Processor<R>>,
  params: T,
  initState: State<D> = {}
): Promise<ProcessorParallelResults<R, D>> => {
  // If 'processors' is a single funtion and not an array, execute it and return result
  if (!Array.isArray(processors)) {
    const response: Partial<ParallelResult<R, D>> = { documents: initState }
    try {
      const { error, documents, result } = await processors(params, initState)

      if (documents != null) response.documents = documents
      if (error != null)
        Object.assign(response, { results: { error, ...(result ?? {}) } })
      else if (result != null) Object.assign(response, { results: result })
    } catch (e) {
      response.results = { error: e }
    }
    return response as ParallelResult<R, D>
  }
  // Create a recursive promise array for all the processor in the 'processors' array
  const responses = await Promise.all(
    processors.map(async processor =>
      processorParallel(processor, params, initState)
    )
  )
  // Reduce the results from all the promise executions into one
  return responses.reduce(
    (
      response: ParallelResults<R, D>,
      { documents: docs = {}, results: res }
    ) => {
      // Add the single result (res) to the results array
      response.results.push(res as R)
      // Merge all the documents that was returned from all the parallel processors
      response.documents = mergeDocuments(response.documents, docs)
      return response
    },
    { documents: initState, results: [] }
  )
}

export const processorWaterfall = async <T, D, R>(
  processors: Processor<R> | Array<Processor<R>>,
  params: T,
  initState: State<D> = {}
): Promise<ProcessorResponse<R, D>> => {
  const response: Partial<ProcessorResponse<R, D>> = { documents: initState }
  // If there is only one processor wrap it in an array
  processors = Array.isArray(processors) ? processors : [processors]
  // If there are no processors left, return only the documents
  if (processors.length === 0) return response

  const [processor, ...rest] = processors
  try {
    // Call the first processor
    const { result, error, documents } = await processor(params, initState)
    // Set the response documents to whatever the processor returns
    response.documents = documents
    // If the processor gave a result set it on the response
    // Else assume it's an error and throw it
    if (result != null) Object.assign(response, { result })
    else throw error
  } catch (e) {
    // Call the recursion if we have any more processors to try
    if (rest?.length > 0) {
      // Merge the documents that was returned from the processor with the current state
      const mergedDocs = mergeDocuments(initState, response.documents ?? {})
      // Call the recursion with the rest of the processors
      return processorWaterfall(rest, params, mergedDocs)
    }

    return { error: e, documents: initState }
  }

  return response
}
