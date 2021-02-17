const { asMap, asObject, asString, asEither } = require('cleaners')

const asMapWithProps = ({ map, props }) => obj => {
  const result = asMap(map)(obj)
  return { ...result, ...asObject(props)(obj) }
}
// asObject({
//   ...asMap(map),
//   ...props
// })

const asRatesDocument = asMapWithProps({
  map: asString,
  props: {
    _id: asString
  }
})

// const asRatesDocument = asObject({
//   ...asMap(asString),
//   ...asObject({
//     _id: asString
//   })
// })

console.log(
  asRatesDocument({
    _id: 'a'
  })
)

console.log(
  asRatesDocument({
    a: 's',
    b: 's',
    c: 's',
    d: 's'
    // _id: 'a'
  })
)

console.log(
  asRatesDocument({
    a: 's',
    b: 's',
    c: 's',
    d: 's',
    _id: 'a'
  })
)

console.log(
  asRatesDocument({
    a: 'a',
    b: 's',
    c: 's',
    d: 's',
    _id: 'a'
  })
)
