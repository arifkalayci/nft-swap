pragma solidity ^0.4.18;

contract ERC721 {
    function totalSupply() public view returns (uint256 total);
    function balanceOf(address _owner) public view returns (uint256 balance);
    function ownerOf(uint256 _tokenId) external view returns (address owner);
    function approve(address _to, uint256 _tokenId) external;
    function transfer(address _to, uint256 _tokenId) external;
    function transferFrom(address _from, address _to, uint256 _tokenId) external;

    event Transfer(address from, address to, uint256 tokenId);
    event Approval(address owner, address approved, uint256 tokenId);
}

contract NFTSwap {
    struct ListedToken {
        address owner;
        address contractAddr;
        uint tokenId;
        string description;
    }

    ListedToken[] public listedTokens;

    mapping (address => uint[]) public ownerTokens;

    // For convenience
    mapping (address => mapping (uint256 => uint)) public tokenIndexInOwnerTokens;

    struct Offer {
        address offerer;
        uint requestedIndex;
        uint offeredIndex;
        int exchangeValue;
        uint expires;
    }

    Offer[] public offers;

    event TokenListed(address indexed contractAddr, uint256 indexed tokenId, string description);
    event TokenUnlisted(address indexed contractAddr, uint256 indexed tokenId);
    event OfferMade(address requestedContractAddr, uint256 requestedTokenId, address offeredContractAddr, uint256 offeredTokenId, int exchangeValue, uint expires);
    event OfferTaken(address takenContractAddr, uint256 takenTokenId, address givenContractAddr, uint256 givenTokenId, int exchangeValue);
    event OfferCancelled(address requestedContractAddr, uint256 requestedTokenId, address offeredContractAddr, uint256 offeredTokenId, int exchangeValue, uint expires);

    function escrowToken(address _contractAddr, uint256 _tokenId, string _description) external returns (uint) {
        uint listedTokenIndex = listedTokens.push(ListedToken({
            owner: msg.sender,
            contractAddr: _contractAddr,
            tokenId: _tokenId,
            description: _description
        }));

        // push returns the new length of the array, so listed token is at index-1
        uint ownerTokenIndex = ownerTokens[msg.sender].push(listedTokenIndex - 1);
        tokenIndexInOwnerTokens[_contractAddr][_tokenId] = ownerTokenIndex - 1;

        // This requires the token to be approved which should be handled by the UI
        ERC721(_contractAddr).transferFrom(msg.sender, this, _tokenId);

        TokenListed(_contractAddr, _tokenId, _description);

        return listedTokenIndex - 1;
    }

    function withdrawToken(uint _listedTokenIndex) external {
        ListedToken storage withdrawnToken = listedTokens[_listedTokenIndex];
        require(withdrawnToken.owner == msg.sender);

        uint movedTokenIndex = ownerTokens[msg.sender][ownerTokens[msg.sender].length -1];

        ownerTokens[msg.sender][tokenIndexInOwnerTokens[withdrawnToken.contractAddr][withdrawnToken.tokenId]] = movedTokenIndex;
        ownerTokens[msg.sender].length--;

        delete tokenIndexInOwnerTokens[withdrawnToken.contractAddr][withdrawnToken.tokenId];

        // Update moved token's index in owner tokens
        ListedToken storage movedToken = listedTokens[movedTokenIndex];
        tokenIndexInOwnerTokens[movedToken.contractAddr][movedToken.tokenId] = ownerTokens[msg.sender].length - 1;

        ERC721(withdrawnToken.contractAddr).transfer(msg.sender, withdrawnToken.tokenId);

        TokenUnlisted(withdrawnToken.contractAddr, withdrawnToken.tokenId);

        delete listedTokens[_listedTokenIndex];
    }

    // Makes an offer for the token listed at _requestedIndex for the token listed at _offeredIndex
    function makeOffer(uint _requestedIndex, uint _offeredIndex, int _exchangeValue, uint _expires) external payable returns (uint) {
        // exchangeValue is the amount of funds which is offered part of the deal. Can be positive or negative.
        // If it's positive, the exact amount must have been send with this transaction
        require(_exchangeValue <= 0 || msg.value == uint(_exchangeValue));

        require(_exchangeValue >= 0 || msg.value == 0);

        require(_expires > block.number);

        ListedToken storage requestedToken = listedTokens[_requestedIndex];

        // Can not make offers to non-listed token
        require(requestedToken.owner != 0x0);

        ListedToken storage offeredToken = listedTokens[_offeredIndex];

        require(offeredToken.owner == msg.sender);

        uint index = offers.push(Offer({
            offerer: msg.sender,
            requestedIndex: _requestedIndex,
            offeredIndex: _offeredIndex,
            exchangeValue: _exchangeValue,
            expires: _expires
        }));

        OfferMade(requestedToken.contractAddr, requestedToken.tokenId, offeredToken.contractAddr, offeredToken.tokenId, _exchangeValue, _expires);

        return index - 1;
    }

    function takeOffer(uint _offerId) external payable {
        Offer storage offer = offers[_offerId];
        require(offer.expires > block.number);

        // Negative exchangeValue means offerer wants to receive funds in part of the deal
        // In that case the exact amount of funds must have been send
        require(offer.exchangeValue >= 0 || msg.value == uint(-offer.exchangeValue));

        ListedToken storage givenToken = listedTokens[offer.requestedIndex];
        require(givenToken.owner == msg.sender);

        ListedToken storage takenToken = listedTokens[offer.offeredIndex];

        // Swap tokens
        givenToken.owner = offer.offerer;
        takenToken.owner = msg.sender;

        uint givenTokenIndex = tokenIndexInOwnerTokens[givenToken.contractAddr][givenToken.tokenId];
        uint takenTokenIndex = tokenIndexInOwnerTokens[takenToken.contractAddr][takenToken.tokenId];

        uint temp = ownerTokens[msg.sender][givenTokenIndex];
        ownerTokens[msg.sender][givenTokenIndex] = ownerTokens[offer.offerer][takenTokenIndex];
        ownerTokens[offer.offerer][takenTokenIndex] = temp;

        temp = tokenIndexInOwnerTokens[givenToken.contractAddr][givenToken.tokenId];
        tokenIndexInOwnerTokens[givenToken.contractAddr][givenToken.tokenId] =
            tokenIndexInOwnerTokens[takenToken.contractAddr][takenToken.tokenId];
        tokenIndexInOwnerTokens[takenToken.contractAddr][takenToken.tokenId] = temp;

        // Transfer exchange value if required. If the value is 0, no funds are transferred
        if (offer.exchangeValue > 0) {
            // We have positive value, meaning offerer pays
            msg.sender.transfer(uint(offer.exchangeValue));
        } else if (offer.exchangeValue < 0) {
            // We have negative value, meaning offerer receives
            offer.offerer.transfer(uint(-offer.exchangeValue));
        }

        // Remove offer since it's taken
        delete offers[_offerId];

        OfferTaken(takenToken.contractAddr, takenToken.tokenId, givenToken.contractAddr, givenToken.tokenId, offer.exchangeValue);
    }

    // This does not remove the approval of the token
    function cancelOffer(uint _offerId) external {
        Offer storage offer = offers[_offerId];
        require(offer.offerer == msg.sender);

        // Refund to offerer if exchangeValue is greater than 0, which means offerer sent it when making the offer
        if (offer.exchangeValue > 0) {
            offer.offerer.transfer(uint(offer.exchangeValue));
        }

        ListedToken storage requestedToken = listedTokens[offer.requestedIndex];
        ListedToken storage offeredToken = listedTokens[offer.offeredIndex];

        OfferCancelled(requestedToken.contractAddr, requestedToken.tokenId, offeredToken.contractAddr, offeredToken.tokenId, offer.exchangeValue, offer.expires);

        delete offers[_offerId];
    }
}
