const NFTSwap = artifacts.require('NFTSwap')
const TestERC721 = artifacts.require('TestERC721')

const chai = require("chai")
const chaiAsPromised = require("chai-as-promised")
chai.use(chaiAsPromised)
const assert = chai.assert

util = require('./util')

contract('NFTSwap offers', function(accounts) {
  let testERC721Inst, nftSwapInst, acc1Token1, acc1Token2, acc1Token3, acc2Token1, acc2Token2, acc2Token3

  mintAndEscrowToken = async (account) => {
    let id = await util.transactAndReturn(testERC721Inst.mint, { from: account })
    await testERC721Inst.approve(nftSwapInst.address, id, { from: account })
    await nftSwapInst.escrowToken(testERC721Inst.address, id, '', { from: account })
    return id
  }

  assertOffer = async (offerId, offerer, requestedIndex, offeredIndex, exchangeValue, expires) => {
    let offer = await nftSwapInst.offers.call(offerId)

    assert.equal(offer[0], offerer)
    assert.equal(offer[1], requestedIndex)
    assert.equal(offer[2], offeredIndex)
    assert.equal(offer[3], exchangeValue)
    assert.equal(offer[4], expires)
  }

  assertOfferDeleted = async (offerId) => {
    assertOffer(offerId, 0, 0, 0, 0, 0)
  }

  before(async function() {
    testERC721Inst = await TestERC721.deployed()
    nftSwapInst = await NFTSwap.deployed()

    acc1Token1 = await mintAndEscrowToken(accounts[0])
    acc1Token2 = await mintAndEscrowToken(accounts[0])
    acc1Token3 = await mintAndEscrowToken(accounts[0])
    acc2Token1 = await mintAndEscrowToken(accounts[1])
    acc2Token2 = await mintAndEscrowToken(accounts[1])
    acc2Token3 = await mintAndEscrowToken(accounts[1])
  })

  it('does not make an offer with unlisted token', function() {
    return assert.isRejected(nftSwapInst.makeOffer(0, util.NON_EXISTENT_NUMBER, 0, util.NON_EXISTENT_NUMBER, { from: accounts[1] }))
  })

  it('does not make an offer with unowned token', function() {
    return assert.isRejected(nftSwapInst.makeOffer(0, 2, 0, util.NON_EXISTENT_NUMBER, { from: accounts[1] }))
  });

  it('does not make an offer which expires in a past block', function() {
    return assert.isRejected(nftSwapInst.makeOffer(0, 3, 0, web3.eth.currentBlock - 1, { from: accounts[1] }))
  })

  it('makes offer', async function() {
    let offerId = await util.transactAndReturn(nftSwapInst.makeOffer, 0, 3, 0, util.NON_EXISTENT_NUMBER, { from: accounts[1] })
    assert.equal(offerId, 0)
    assertOffer(offerId, accounts[1], 0, 3, 0, util.NON_EXISTENT_NUMBER)
  })

  it('does not cancel not-owned offer', function() {
    return assert.isRejected(nftSwapInst.cancelOffer(0, { from: accounts[0] }))
  })

  it('cancels an offer', async function() {
    await nftSwapInst.cancelOffer(0, { from: accounts[1] })
    assertOfferDeleted(0)
  })

  it('does not make an offer with positive exchange value but no funds', function() {
    return assert.isRejected(nftSwapInst.makeOffer.call(0, 3, 1, util.NON_EXISTENT_NUMBER, { from: accounts[1] }))
  })

  it('does not make an offer with positive exchange value but less funds than the exchange value', function() {
    return assert.isRejected(nftSwapInst.makeOffer.call(0, 3, 2, util.NON_EXISTENT_NUMBER, { from: accounts[1], value: 1 }))
  })

  it('does not make an offer with positive exchange value but more funds than the exchange value', function() {
    return assert.isRejected(nftSwapInst.makeOffer.call(0, 3, 1, util.NON_EXISTENT_NUMBER, { from: accounts[1], value: 2 }))
  })

  // Dependent on previous tests
  it('makes offer with positive exchange value', async function() {
    let offerId = await util.transactAndReturn(nftSwapInst.makeOffer, 0, 3, 1, util.NON_EXISTENT_NUMBER, { from: accounts[1], value: 1 })
    assert.equal(offerId, 1)
    assertOffer(offerId, accounts[1], 0, 3, 1, util.NON_EXISTENT_NUMBER)
  })

  // Dependent on previous tests
  it('cancels an offer with positive exchange value', async function() {
    let beforeBalance = web3.eth.getBalance(accounts[1])
    let result = await nftSwapInst.cancelOffer(1, { from: accounts[1], gasPrice: 1 })
    let afterBalance = web3.eth.getBalance(accounts[1])

    // Since we have a given a gasPrice of 1 wei, tx cost is equal to gasUsed
    assert(beforeBalance.minus(result.receipt.gasUsed).add(1).equals(afterBalance))
    assertOfferDeleted(1)
  })

  it('does not make an offer with negative exchange value but with funds', function() {
    return assert.isRejected(nftSwapInst.makeOffer.call(0, 3, -1, util.NON_EXISTENT_NUMBER, { from: accounts[1], value: 1 }))
  })

  // Dependent on previous tests
  it('makes offer with negative exchange value', async function() {
    let offerId = await util.transactAndReturn(nftSwapInst.makeOffer, 0, 3, -1, util.NON_EXISTENT_NUMBER, { from: accounts[1] })
    assert.equal(offerId, 2)
    assertOffer(offerId, accounts[1], 0, 3, -1, util.NON_EXISTENT_NUMBER)
  })

  // Dependent on previous tests
  it('cancels an offer with positive exchange value', async function() {
    let beforeBalance = web3.eth.getBalance(accounts[1])
    let result = await nftSwapInst.cancelOffer(2, { from: accounts[1], gasPrice: 1 })
    let afterBalance = web3.eth.getBalance(accounts[1])

    // Since we have a given a gasPrice of 1 wei, tx cost is equal to gasUsed
    assert(beforeBalance.minus(result.receipt.gasUsed).equals(afterBalance))
    assertOfferDeleted(2)
  })

  // it('makes multiple offers to the same token with different offered tokens', async function() {
  //   let offerId = await nftSwapInst.makeOffer.call(0, 3, 0, util.NON_EXISTENT_NUMBER, { from: accounts[1] })
  //   await nftSwapInst.makeOffer(0, 3, 1, util.NON_EXISTENT_NUMBER, { from: accounts[1], value: 1 })

  //   let offerId = await nftSwapInst.makeOffer.call(0, 3, 0, util.NON_EXISTENT_NUMBER, { from: accounts[1] })
  // })
})
