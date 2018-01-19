const NFTSwap = artifacts.require('NFTSwap')
const TestERC721 = artifacts.require('TestERC721')

const chai = require("chai")
const assert = chai.assert

util = require('./util')

contract('NFTSwap offers', function(accounts) {
  let testERC721Inst, nftSwapInst, listedToken1, listedToken2, listedToken3

  const mintAndEscrowToken = async (account) => {
    let id = await util.transactAndReturn(testERC721Inst.mint, { from: account })
    await testERC721Inst.approve(nftSwapInst.address, id, { from: account })
    return await util.transactAndReturn(nftSwapInst.escrowToken, testERC721Inst.address, id, '', { from: account })
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

    listedToken1 = await mintAndEscrowToken(accounts[0])
    listedToken2 = await mintAndEscrowToken(accounts[1])
    listedToken3 = await mintAndEscrowToken(accounts[2])
  })

  it('does not make offer with unlisted token', async function() {
    await util.expectInvalidOpcode(nftSwapInst.makeOffer(listedToken1, util.NON_EXISTENT_NUMBER, 0, util.NON_EXISTENT_NUMBER, { from: accounts[1] }))
  })

  it('does not make offer with unowned token', async function() {
    await util.expectRevert(nftSwapInst.makeOffer(listedToken1, listedToken3, 0, util.NON_EXISTENT_NUMBER, { from: accounts[1] }))
  });

  it('does not make offer which expires immediately', async function() {
    await util.expectRevert(nftSwapInst.makeOffer(listedToken1, listedToken2, 0, 0, { from: accounts[1] }))
  })

  it('makes offer', async function() {
    let offerId = await util.transactAndReturn(nftSwapInst.makeOffer, listedToken1, listedToken2, 0, util.NON_EXISTENT_NUMBER, { from: accounts[1] })
    assert.equal(offerId, 0)
    await assertOffer(offerId, accounts[1], listedToken1, listedToken2, 0, util.NON_EXISTENT_NUMBER)
  })

  it('does not cancel not-owned offer', async function() {
    await util.expectRevert(nftSwapInst.cancelOffer(0, { from: accounts[0] }))
  })

  it('cancels offer', async function() {
    await nftSwapInst.cancelOffer(0, { from: accounts[1] })
    await assertOfferDeleted(0)
  })

  it('does not make offer with positive exchange value but no funds', async function() {
    await util.expectRevert(nftSwapInst.makeOffer(listedToken1, listedToken2, 1, util.NON_EXISTENT_NUMBER, { from: accounts[1] }))
  })

  it('does not make offer with positive exchange value but less funds than the exchange value', async function() {
    await util.expectRevert(nftSwapInst.makeOffer(listedToken1, listedToken2, 2, util.NON_EXISTENT_NUMBER, { from: accounts[1], value: 1 }))
  })

  it('does not make offer with positive exchange value but more funds than the exchange value', async function() {
    await util.expectRevert(nftSwapInst.makeOffer(listedToken1, listedToken2, 1, util.NON_EXISTENT_NUMBER, { from: accounts[1], value: 2 }))
  })

  it('makes offer with positive exchange value', async function() {
    let offerId = await util.transactAndReturn(nftSwapInst.makeOffer, listedToken1, listedToken2, 1, util.NON_EXISTENT_NUMBER, { from: accounts[1], value: 1 })
    assert.equal(offerId, 1)
    await assertOffer(offerId, accounts[1], listedToken1, listedToken2, 1, util.NON_EXISTENT_NUMBER)
  })

  it('cancels offer with positive exchange value', async function() {
    let accBeforeBalance = web3.eth.getBalance(accounts[1])
    let contractBeforeBalance = web3.eth.getBalance(nftSwapInst.address)
    let result = await nftSwapInst.cancelOffer(1, { from: accounts[1], gasPrice: 1 })
    let accAfterBalance = web3.eth.getBalance(accounts[1])
    let contractAfterBalance = web3.eth.getBalance(nftSwapInst.address)

    let exchangeValue = 1 // Exchange value of the cancelled order

    // Since we have a given a gasPrice of 1 wei, tx cost is equal to gasUsed
    assert(accBeforeBalance.minus(result.receipt.gasUsed).add(exchangeValue).equals(accAfterBalance))

    // Make sure funds are refunded
    assert(contractBeforeBalance.minus(exchangeValue).equals(contractAfterBalance))

    await assertOfferDeleted(1)
  })

  it('does not make offer with negative exchange value but with funds', async function() {
    await util.expectRevert(nftSwapInst.makeOffer(listedToken1, listedToken2, -1, util.NON_EXISTENT_NUMBER, { from: accounts[1], value: 1 }))
  })

  it('makes offer with negative exchange value', async function() {
    let offerId = await util.transactAndReturn(nftSwapInst.makeOffer, listedToken1, listedToken2, -1, util.NON_EXISTENT_NUMBER, { from: accounts[1] })
    assert.equal(offerId, 2)
    await assertOffer(offerId, accounts[1], listedToken1, listedToken2, -1, util.NON_EXISTENT_NUMBER)
  })

  it('cancels offer with negative exchange value', async function() {
    let offer = await nftSwapInst.offers.call(2)

    let accBeforeBalance = web3.eth.getBalance(accounts[1])
    let contractBeforeBalance = web3.eth.getBalance(nftSwapInst.address)
    let result = await nftSwapInst.cancelOffer(2, { from: accounts[1], gasPrice: 1 })
    let accAfterBalance = web3.eth.getBalance(accounts[1])
    let contractAfterBalance = web3.eth.getBalance(nftSwapInst.address)

    // Since we have a given a gasPrice of 1 wei, tx cost is equal to gasUsed
    assert(accBeforeBalance.minus(result.receipt.gasUsed).equals(accAfterBalance))

    // Make sure no funds were transferred
    assert(contractBeforeBalance.equals(contractAfterBalance))

    await assertOfferDeleted(2)
  })
})
