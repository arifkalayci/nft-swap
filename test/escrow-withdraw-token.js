const NFTSwap = artifacts.require('NFTSwap')
const TestERC721 = artifacts.require('TestERC721')

const chai = require("chai")
const chaiAsPromised = require("chai-as-promised")
chai.use(chaiAsPromised)
const assert = chai.assert

util = require('./util')

contract('NFTSwap tokens', function(accounts) {
  let testERC721Inst, nftSwapInst, unapprovedToken, approvedToken1, approvedToken2, approvedToken3

  escrowToken = async (contractAddr, tokenId, description) => {
    let index = await nftSwapInst.escrowToken.call(contractAddr, tokenId, description, { from: accounts[0] })
    await nftSwapInst.escrowToken(contractAddr, tokenId, description, { from: accounts[0] })
    return index
  }

  assertListedTokenDeleted = async (index) => {
    assertListedToken(index, 0, 0, 0, '')
  }

  assertListedToken = async (index, account, contractAddr, tokenId, description) => {
    let listedToken = await nftSwapInst.listedTokens.call(index)
    assert.equal(listedToken[0], account)
    assert.equal(listedToken[1], contractAddr)
    assert(listedToken[2].equals(tokenId))
    assert.equal(listedToken[3], description)
  }

  before(async function() {
    testERC721Inst = await TestERC721.deployed()
    nftSwapInst = await NFTSwap.deployed()

    unapprovedToken = await testERC721Inst.mint.call()
    await testERC721Inst.mint({ from: accounts[0] })

    approvedToken1 = await testERC721Inst.mint.call()
    await testERC721Inst.mint({ from: accounts[0] })
    await testERC721Inst.approve(nftSwapInst.address, approvedToken1, { from: accounts[0] })

    approvedToken2 = await testERC721Inst.mint.call()
    await testERC721Inst.mint({ from: accounts[0] })
    await testERC721Inst.approve(nftSwapInst.address, approvedToken2, { from: accounts[0] })

    approvedToken3 = await testERC721Inst.mint.call()
    await testERC721Inst.mint({ from: accounts[0] })
    await testERC721Inst.approve(nftSwapInst.address, approvedToken3, { from: accounts[0] })
  })

  it('does not escrow unapproved token', async function() {
      await util.expectRevert(nftSwapInst.escrowToken(testERC721Inst.address, unapprovedToken, '', { from: accounts[0] }))
  })

  it('escrows first approved token', async function() {
    let listedTokenIndex = await escrowToken(testERC721Inst.address, approvedToken1, 'test1')

    assert.equal(listedTokenIndex, 0)

    assertListedToken(listedTokenIndex, accounts[0], testERC721Inst.address, approvedToken1, 'test1')

    assert((await nftSwapInst.ownerTokens.call(accounts[0], 0)).equals(0))
    assert((await nftSwapInst.tokenIndexInOwnerTokens.call(testERC721Inst.address, approvedToken1)).equals(0))
  })

  it('escrows second approved token', async function() {
    let listedTokenIndex = await escrowToken(testERC721Inst.address, approvedToken2, 'test2')

    assert.equal(listedTokenIndex, 1)

    assertListedToken(listedTokenIndex, accounts[0], testERC721Inst.address, approvedToken2, 'test2')

    assert((await nftSwapInst.ownerTokens.call(accounts[0], 0)).equals(0))
    assert((await nftSwapInst.ownerTokens.call(accounts[0], 1)).equals(1))

    assert((await nftSwapInst.tokenIndexInOwnerTokens.call(testERC721Inst.address, approvedToken1)).equals(0))
    assert((await nftSwapInst.tokenIndexInOwnerTokens.call(testERC721Inst.address, approvedToken2)).equals(1))
  })

  it('withdraws first approved token', async function() {
    await nftSwapInst.withdrawToken(0, { from: accounts[0] })

    assertListedTokenDeleted(0)

    assert((await nftSwapInst.ownerTokens.call(accounts[0], 0)).equals(1))
    await util.expectInvalidOpcode(nftSwapInst.ownerTokens.call(accounts[0], 1))

    assert((await nftSwapInst.tokenIndexInOwnerTokens.call(testERC721Inst.address, approvedToken1)).equals(0))
    assert((await nftSwapInst.tokenIndexInOwnerTokens.call(testERC721Inst.address, approvedToken2)).equals(0))
  })

  it('escrows third approved token', async function() {
    let listedTokenIndex = await escrowToken(testERC721Inst.address, approvedToken3, 'test3')

    assert.equal(listedTokenIndex, 2)

    assertListedToken(listedTokenIndex, accounts[0], testERC721Inst.address, approvedToken3, 'test3')

    assert((await nftSwapInst.ownerTokens.call(accounts[0], 0)).equals(1))
    assert((await nftSwapInst.ownerTokens.call(accounts[0], 1)).equals(2))

    assert((await nftSwapInst.tokenIndexInOwnerTokens.call(testERC721Inst.address, approvedToken1)).equals(0))
    assert((await nftSwapInst.tokenIndexInOwnerTokens.call(testERC721Inst.address, approvedToken2)).equals(0))
    assert((await nftSwapInst.tokenIndexInOwnerTokens.call(testERC721Inst.address, approvedToken3)).equals(1))
  })

  it('withdraws third approved token', async function() {
    await nftSwapInst.withdrawToken(2, { from: accounts[0] })

    assertListedTokenDeleted(2)

    assert((await nftSwapInst.ownerTokens.call(accounts[0], 0)).equals(1))
    await util.expectInvalidOpcode(nftSwapInst.ownerTokens.call(accounts[0], 1))

    assert((await nftSwapInst.tokenIndexInOwnerTokens.call(testERC721Inst.address, approvedToken1)).equals(0))
    assert((await nftSwapInst.tokenIndexInOwnerTokens.call(testERC721Inst.address, approvedToken2)).equals(0))
    assert((await nftSwapInst.tokenIndexInOwnerTokens.call(testERC721Inst.address, approvedToken3)).equals(0))
  })

  it('escrows first approved token again', async function() {
    await testERC721Inst.approve(nftSwapInst.address, approvedToken1, { from: accounts[0] })

    let listedTokenIndex = await escrowToken(testERC721Inst.address, approvedToken1, 'test4')

    assert.equal(listedTokenIndex, 3)

    assertListedToken(listedTokenIndex, accounts[0], testERC721Inst.address, approvedToken1, 'test4')

    assert((await nftSwapInst.ownerTokens.call(accounts[0], 0)).equals(1))
    assert((await nftSwapInst.ownerTokens.call(accounts[0], 1)).equals(3))
    await util.expectInvalidOpcode(nftSwapInst.ownerTokens.call(accounts[0], 2))

    assert((await nftSwapInst.tokenIndexInOwnerTokens.call(testERC721Inst.address, approvedToken1)).equals(1))
    assert((await nftSwapInst.tokenIndexInOwnerTokens.call(testERC721Inst.address, approvedToken2)).equals(0))
    assert((await nftSwapInst.tokenIndexInOwnerTokens.call(testERC721Inst.address, approvedToken3)).equals(0))
  })
})
