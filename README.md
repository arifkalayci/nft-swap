This smart contract enables peer to peer swapping of any tokens adhering to the [ERC721 standard](https://github.com/ethereum/eips/issues/721).
### How it works
  - The user who wants to swap a non-fungible token escrows it to the smart contract with the `escrowToken(address _contractAddr, uint256 _tokenId, string _description)` function. `_contractAddr` and `_tokenId` identifies the token to be escrowed. `_description` is an optional string to display on a marketplace. (Token must have been approved for transfer by this contract using the `approve` function of the ERC-721 contract). This returns the index of the token in the list of all escrowed tokens. All escrowed tokens are open for offers.
  -  To make an offer, the second user also escrows their token and then calls the `makeOffer(uint _requestedIndex, uint _offeredIndex, int _exchangeValue, uint _expiresIn)` function. Here the user wants to swap `_requestedIndex` for `_offeredIndex` with an `_exchangeValue`. Take note that these tokens can be of different types. Exchange value can be 0, positive, negative. An exchange value of 0 means the offerer wants to swap the tokens without any value transfer. Positive exchange value means the offerer is offering some funds in the addition to the offered token, whereas a negative exchange value means the offerer is requesting funds in part of the deal. (If a positive value is given, the exact amount of funds must have been sent with the transaction.) `_expiresIn` parameters sets the expiration block of the offer. This returns the offer index, which can be used later to cancel the offer by calling the `cancelOffer(uint _offerId)` function.
  -  If a token owner likes an offer, they can take it using the `takeOffer` function. The trade will be made according to the offer terms, so if the offer has a negative exchange value, the exact amount specified must be sent with this transaction which will be forwarded to the offerer. If it has a positive exchange value the taker will receive the funds. In the case of a 0 exchange value no funds will be transferred.
  -  Finally, the token owners can withdraw any escrowed token anytime using the `withdrawToken` function.
### Code walkthrough
_To be written_
### TODO
- Add `buyNowPrice` to listings
- Make swapping tokens optional, i.e. an offer can be made only with funds
- Refund excess funds instead of reverting
- Users should be able to easily access their own offers (made and received)
- Test events
- Swap multiple tokens in one transaction
- Measure gas usage
### Notes
- Each test in a test suite (`contract` block) depend on previous tests meaning they cannot be run separately.
- Also see [this issue](https://github.com/trufflesuite/truffle/issues/557) with truffle, where tests fail randomly.
