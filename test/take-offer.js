const NFTSwap = artifacts.require('NFTSwap')
const TestERC721 = artifacts.require('TestERC721')

const chai = require("chai")
const assert = chai.assert

util = require('./util')

contract('NFTSwap offers', function(accounts) {
  let testERC721Inst, nftSwapInst, acc1Token1, acc1Token2, acc1Token3, acc2Token1, acc2Token2, acc2Token3,
    offer, offerFromAcc3ToAcc2, offerWithSoonExpiringBlockNumber

  const mintAndEscrowToken = async (account) => {
    let id = await util.transactAndReturn(testERC721Inst.mint, { from: account })
    await testERC721Inst.approve(nftSwapInst.address, id, { from: account })
    await nftSwapInst.escrowToken(testERC721Inst.address, id, '', { from: account })
    return id
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

    acc1Token1 = await mintAndEscrowToken(accounts[0])
    acc1Token2 = await mintAndEscrowToken(accounts[0])
    acc1Token3 = await mintAndEscrowToken(accounts[0])
    acc2Token1 = await mintAndEscrowToken(accounts[1])
    acc2Token2 = await mintAndEscrowToken(accounts[1])
    acc2Token3 = await mintAndEscrowToken(accounts[1])
    acc3Token1 = await mintAndEscrowToken(accounts[2])

    offer = await util.transactAndReturn(nftSwapInst.makeOffer, acc1Token1, acc2Token1, 0, util.NON_EXISTENT_NUMBER, { from: accounts[1] })

    // // offerWithPositiveExchangeValue = await nftSwapInst.makeOffer(acc1Token1, acc2Token1, 1, util.NON_EXISTENT_NUMBER, { from: accounts[1] })
    // // await nftSwapInst.makeOffer(acc1Token1, acc2Token1, 1, util.NON_EXISTENT_NUMBER, { from: accounts[1] })

    // // offerWithNegativeExchangeValue = await nftSwapInst.makeOffer(acc1Token1, acc2Token1, -1, util.NON_EXISTENT_NUMBER, { from: accounts[1] })
    // // await nftSwapInst.makeOffer(acc1Token1, acc2Token1, -1, util.NON_EXISTENT_NUMBER, { from: accounts[1] })

    offerFromAcc3ToAcc2 = await util.transactAndReturn(nftSwapInst.makeOffer, acc2Token1, acc3Token1, 0, util.NON_EXISTENT_NUMBER, { from: accounts[2] })

    offerWithSoonExpiringBlockNumber = await util.transactAndReturn(nftSwapInst.makeOffer, acc1Token1, acc2Token1, 0, 1, { from: accounts[1] })
    await util.mineOneBlock()
  })

  it('does not take non-existent offer', async function() {
    await util.expectInvalidOpcode(nftSwapInst.takeOffer(util.NON_EXISTENT_NUMBER, { from: accounts[0] }))
  })

  it('does not take offer which is for not-owned token', async function() {
    await util.expectRevert(nftSwapInst.takeOffer(offerFromAcc3ToAcc2, { from: accounts[0] }))
  })

  it('does not take expired offer', async function() {
    await util.expectRevert(nftSwapInst.takeOffer(offerWithSoonExpiringBlockNumber, { from: accounts[0] }))
  })

  it('takes offer', async function() {
    let acc1BeforeBalance = web3.eth.getBalance(accounts[0])
    let acc2BeforeBalance = web3.eth.getBalance(accounts[1])
    let contractBeforeBalance = web3.eth.getBalance(nftSwapInst.address)
    let result = await nftSwapInst.takeOffer(offer, { from: accounts[0], gasPrice: 1 })
    let acc1AfterBalance = web3.eth.getBalance(accounts[0])
    let acc2AfterBalance = web3.eth.getBalance(accounts[1])
    let contractAfterBalance = web3.eth.getBalance(nftSwapInst.address)

    // Check balances
    assert(acc1BeforeBalance.minus(result.receipt.gasUsed).equals(acc1AfterBalance))
    assert(acc2BeforeBalance.equals(acc2AfterBalance))
    assert(contractBeforeBalance.equals(contractAfterBalance))

    // Check owners
    assert.equal((await nftSwapInst.listedTokens.call(acc1Token1))[0], accounts[1])
    assert.equal((await nftSwapInst.listedTokens.call(acc2Token1))[0], accounts[0])

    // Check if tokens swapped
    assert((await nftSwapInst.ownerTokens.call(accounts[0], 0)).equals(acc2Token1))
    assert((await nftSwapInst.ownerTokens.call(accounts[1], 0)).equals(acc1Token1))

    // Make sure the rest of the tokens are untouched
    assert((await nftSwapInst.ownerTokens.call(accounts[0], 1)).equals(acc1Token2))
    assert((await nftSwapInst.ownerTokens.call(accounts[0], 2)).equals(acc1Token3))
    assert((await nftSwapInst.ownerTokens.call(accounts[1], 1)).equals(acc2Token2))
    assert((await nftSwapInst.ownerTokens.call(accounts[1], 2)).equals(acc2Token3))

    // Check if token indexes are correct
    assert((await nftSwapInst.tokenIndexInOwnerTokens.call(testERC721Inst.address, acc2Token1)).equals(0))
    assert((await nftSwapInst.tokenIndexInOwnerTokens.call(testERC721Inst.address, acc1Token2)).equals(1))
    assert((await nftSwapInst.tokenIndexInOwnerTokens.call(testERC721Inst.address, acc1Token3)).equals(2))
    assert((await nftSwapInst.tokenIndexInOwnerTokens.call(testERC721Inst.address, acc1Token1)).equals(0))
    assert((await nftSwapInst.tokenIndexInOwnerTokens.call(testERC721Inst.address, acc2Token2)).equals(1))
    assert((await nftSwapInst.tokenIndexInOwnerTokens.call(testERC721Inst.address, acc2Token3)).equals(2))

    await assertOfferDeleted(offer)
  })

  it('does not take offer with positive exchange value without sending funds')
  it('takes offer with positive exchange value')
  it('takes offer with negative exchange value')
  it('does not take offer which is for already traded token')

  it('does not withdraw given token')
  it('withdraws taken token')
})
