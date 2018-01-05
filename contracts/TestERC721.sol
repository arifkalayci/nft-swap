pragma solidity ^0.4.18;

contract TestERC721 {
    uint public totalSupply;

    mapping (address => uint) public balanceOf;
    mapping (uint => address) public ownerOf;
    mapping (uint => address) public approvals;

    event Transfer(address from, address to, uint256 tokenId);
    event Approval(address owner, address approved, uint256 tokenId);

    function approve(address _to, uint256 _tokenId) external {
        require(msg.sender == ownerOf[_tokenId]);

        approvals[_tokenId] = _to;
        Approval(ownerOf[_tokenId], _to, _tokenId);
    }

    function transfer(address _to, uint256 _tokenId) external {
        require(msg.sender == ownerOf[_tokenId]);
        _transfer(msg.sender, _to, _tokenId);
    }

    function transferFrom(address _from, address _to, uint256 _tokenId) external {
        require(msg.sender == approvals[_tokenId]);
        _transfer(_from, _to, _tokenId);
    }

    function _transfer(address _from, address _to, uint256 _tokenId) internal {
        delete approvals[_tokenId];
        ownerOf[_tokenId] = _to;
        balanceOf[_from]--;
        balanceOf[_to]++;
        Transfer(_from, _to, _tokenId);
    }

    function mint() external returns (uint) {
        ownerOf[totalSupply] = msg.sender;
        balanceOf[msg.sender]++;
        return totalSupply++;
    }
}
