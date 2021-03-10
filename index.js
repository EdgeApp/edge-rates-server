const pipe = (...funcs) =>
  funcs.reduce((curried, func) => (...args) => func(curried(...args)))

const a = v => `${v + 1}`
const b = v => parseInt(v) + 1
const c = v => `${v + 1}`
// const d = (v: string): number => parseInt(v) + 1

const piped = pipe(a, b, c)
console.log(piped(1))
