const NFTSwap = artifacts.require('NFTSwap')
const TestERC721 = artifacts.require('TestERC721')

module.exports = function(deployer) {
  deployer.deploy(NFTSwap)
  deployer.deploy(TestERC721)
};
