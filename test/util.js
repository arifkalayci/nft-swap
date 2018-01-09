const NON_EXISTENT_NUMBER = 10 ** 10  // A big enough number which we are sure we won't encounter

const transactAndReturn = async (fn, ...params) => {
  let res = await fn.call(...params)
  await fn(...params)
  return res
}

const expectRevert = async (promise) => {
  try {
    await promise;
  } catch (err) {
    assert(err.message.includes("revert"), "Expected revert, got `" + err + "` instead")
    return
  }
  assert.fail("Expected revert not received")
}

const expectInvalidOpcode = async (promise) => {
  try {
    await promise;
  } catch (err) {
    assert(err.message.includes("invalid opcode"), "Expected invalid opcode, got `" + err + "` instead")
    return
  }
  assert.fail("Expected invalid opcode not received")
}

module.exports = {
  NON_EXISTENT_NUMBER,
  transactAndReturn,
  expectRevert,
  expectInvalidOpcode
}
