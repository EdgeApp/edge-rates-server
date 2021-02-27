import { Processor, ProcessorResponse, State } from '../types/types'
import { mergeDocuments } from './utils'

export const processorParallel = async <T, D, R>(
  processors: Processor<T, D, R> | Array<Processor<T, D, R>>,
  params: T,
  state: State<D> = {}
): Promise<ProcessorResponse<R, D>> => {
  // If 'processors' is a single funtion and not an array, execute it and return result
  if (!Array.isArray(processors))
    return await Promise.resolve(processors(params, state)).catch(error => ({
      error
    }))
  // Create a recursive promise array for all the processor in the 'processors' array
  const responses = await Promise.all(
    processors.map(
      async processor => await processorParallel(processor, params, state)
    )
  )
  // Reduce the results from all the promise executions into one
  return responses.reduce(
    (response: ProcessorResponse<R, D>, { documents = {}, result, error }) => ({
      // Add the single result (res) to the results array
      result: [...(response.result as R[]), (result as R) ?? { error }],
      // Merge all the documents that was returned from all the parallel processors
      documents:
        response.documents != null
          ? mergeDocuments(response.documents, documents)
          : documents
    }),
    { documents: state, result: [] }
  )
}

export const processorWaterfall = async <T, D, R>(
  processors: Processor<T, D, R> | Array<Processor<T, D, R>>,
  params: T,
  state: State<D> = {}
): Promise<ProcessorResponse<R, D>> => {
  const response: Partial<ProcessorResponse<R, D>> = { documents: state }
  // If there is only one processor wrap it in an array
  processors = Array.isArray(processors) ? processors : [processors]
  // If there are no processors left, return only the documents
  if (processors.length === 0) return response
  // Get the first processor in the array
  const [processor, ...rest] = processors
  try {
    // Call the first processor
    const { result, error, documents } = await processor(params, state)
    // Set the response documents to whatever the processor returns
    response.documents = documents
    // If the processor didn't give a result or it gave an error, throw the error
    if (result == null || error != null) throw error
    // Set the result on the response
    return { ...response, result }
  } catch (e) {
    // If there are no more processors to try, return an error
    if (rest?.length <= 0) return { error: e, documents: state }
    // Merge the documents that was returned from the processor with the current state
    const mergedDocs = mergeDocuments(state, response.documents ?? {})
    // Call the recursion with the rest of the processors
    return await processorWaterfall(rest, params, mergedDocs)
  }
}
