const FAR_BLOCK = 10 ** 10  // A block number far in the future

const transactAndReturn = async (fn, ...params) => {
  let res = await fn.call(...params)
  await fn(...params)
  return res
}

module.exports = {
  FAR_BLOCK,
  transactAndReturn
}
