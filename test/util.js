const NON_EXISTENT_NUMBER = 10 ** 10  // A big enough number which we are sure we won't encounter

const transactAndReturn = async (fn, ...params) => {
  let res = await fn.call(...params)
  await fn(...params)
  return res
}

module.exports = {
  NON_EXISTENT_NUMBER,
  transactAndReturn
}
