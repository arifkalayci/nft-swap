const NFTSwap = artifacts.require('NFTSwap')
const TestERC721 = artifacts.require('TestERC721')

const chai = require("chai")
const chaiAsPromised = require("chai-as-promised")
chai.use(chaiAsPromised)
const assert = chai.assert

util = require('./util')

contract('NFTSwap offers', function(accounts) {
  let testERC721Inst, nftSwapInst, acc1Token, acc2Token, acc3Token

  const mintAndEscrowToken = async (account) => {
    let id = await util.transactAndReturn(testERC721Inst.mint, { from: account })
    await testERC721Inst.approve(nftSwapInst.address, id, { from: account })
    await nftSwapInst.escrowToken(testERC721Inst.address, id, '', { from: account })
    return id
  }

  const assertOffer = async (offerId, offerer, requestedIndex, offeredIndex, exchangeValue, expiresIn) => {
    let offer = await nftSwapInst.offers.call(offerId)

    assert.equal(offer[0], offerer)
    assert(offer[1].equals(requestedIndex))
    assert(offer[2].equals(offeredIndex))
    assert(offer[3].equals(exchangeValue))
    assert(offer[4].equals(web3.eth.blockNumber + expiresIn))
  }

  const assertOfferDeleted = async (offerId) => {
    let offer = await nftSwapInst.offers.call(offerId)

    assert.equal(offer[0], 0)
    assert(offer[1].equals(0))
    assert(offer[2].equals(0))
    assert(offer[3].equals(0))
    assert(offer[4].equals(0))
  }

  before(async function() {
    testERC721Inst = await TestERC721.deployed()
    nftSwapInst = await NFTSwap.deployed()

    acc1Token = await mintAndEscrowToken(accounts[0])
    acc2Token = await mintAndEscrowToken(accounts[1])
    acc3Token1 = await util.transactAndReturn(testERC721Inst.mint, { from: accounts[2] })
    acc3Token2 = await mintAndEscrowToken(accounts[2])
  })

  it('does not make an offer with unlisted token', function() {
    return assert.isRejected(nftSwapInst.makeOffer(acc1Token, acc3Token1, 0, util.NON_EXISTENT_NUMBER, { from: accounts[1] }))
  })

  it('does not make an offer with unowned token', function() {
    return assert.isRejected(nftSwapInst.makeOffer(acc1Token, acc3Token2, 0, util.NON_EXISTENT_NUMBER, { from: accounts[1] }))
  });

  it('does not make an offer which expires immediately', function() {
    return assert.isRejected(nftSwapInst.makeOffer(acc1Token, acc2Token, 0, 0, { from: accounts[1] }))
  })

  it('makes offer', async function() {
    let offerId = await util.transactAndReturn(nftSwapInst.makeOffer, acc1Token, acc2Token, 0, util.NON_EXISTENT_NUMBER, { from: accounts[1] })
    assert.equal(offerId, 0)
    await assertOffer(offerId, accounts[1], acc1Token, acc2Token, 0, util.NON_EXISTENT_NUMBER)
  })

  it('does not cancel not-owned offer', function() {
    return assert.isRejected(nftSwapInst.cancelOffer(0, { from: accounts[0] }))
  })

  it('cancels an offer', async function() {
    await nftSwapInst.cancelOffer(0, { from: accounts[1] })
    await assertOfferDeleted(0)
  })

  it('does not make an offer with positive exchange value but no funds', function() {
    return assert.isRejected(nftSwapInst.makeOffer(acc1Token, acc2Token, 1, util.NON_EXISTENT_NUMBER, { from: accounts[1] }))
  })

  it('does not make an offer with positive exchange value but less funds than the exchange value', function() {
    return assert.isRejected(nftSwapInst.makeOffer(acc1Token, acc2Token, 2, util.NON_EXISTENT_NUMBER, { from: accounts[1], value: 1 }))
  })

  it('does not make an offer with positive exchange value but more funds than the exchange value', function() {
    return assert.isRejected(nftSwapInst.makeOffer(acc1Token, acc2Token, 1, util.NON_EXISTENT_NUMBER, { from: accounts[1], value: 2 }))
  })

  // Dependent on previous tests
  it('makes offer with positive exchange value', async function() {
    let offerId = await util.transactAndReturn(nftSwapInst.makeOffer, acc1Token, acc2Token, 1, util.NON_EXISTENT_NUMBER, { from: accounts[1], value: 1 })
    assert.equal(offerId, 1)
    await assertOffer(offerId, accounts[1], acc1Token, acc2Token, 1, util.NON_EXISTENT_NUMBER)
  })

  // Dependent on previous tests
  it('cancels an offer with positive exchange value', async function() {
    let beforeBalance = web3.eth.getBalance(accounts[1])
    let result = await nftSwapInst.cancelOffer(1, { from: accounts[1], gasPrice: 1 })
    let afterBalance = web3.eth.getBalance(accounts[1])

    // Since we have a given a gasPrice of 1 wei, tx cost is equal to gasUsed
    assert(beforeBalance.minus(result.receipt.gasUsed).add(1).equals(afterBalance))
    await assertOfferDeleted(1)
  })

  it('does not make an offer with negative exchange value but with funds', function() {
    return assert.isRejected(nftSwapInst.makeOffer(acc1Token, acc2Token, -1, util.NON_EXISTENT_NUMBER, { from: accounts[1], value: 1 }))
  })

  // Dependent on previous tests
  it('makes offer with negative exchange value', async function() {
    let offerId = await util.transactAndReturn(nftSwapInst.makeOffer, acc1Token, acc2Token, -1, util.NON_EXISTENT_NUMBER, { from: accounts[1] })
    assert.equal(offerId, 2)
    await assertOffer(offerId, accounts[1], acc1Token, acc2Token, -1, util.NON_EXISTENT_NUMBER)
  })

  // Dependent on previous tests
  it('cancels an offer with positive exchange value', async function() {
    let beforeBalance = web3.eth.getBalance(accounts[1])
    let result = await nftSwapInst.cancelOffer(2, { from: accounts[1], gasPrice: 1 })
    let afterBalance = web3.eth.getBalance(accounts[1])

    // Since we have a given a gasPrice of 1 wei, tx cost is equal to gasUsed
    assert(beforeBalance.minus(result.receipt.gasUsed).equals(afterBalance))
    await assertOfferDeleted(2)
  })
})
