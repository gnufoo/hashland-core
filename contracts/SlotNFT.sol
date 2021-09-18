//SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract SlotNFT is ERC721, Ownable, IERC721Receiver 
{
	uint256 public autoTokenId;
	mapping(uint256=>uint8) public tokenLevel;

	uint256 constant UPGRADE_MATERIAL_NUM = 4;

	event UPGRADE(uint256, uint8, uint8);

    constructor() ERC721("HASH LAND SLOT NFT", "SLOT") 
    {
    	autoTokenId = 0;
    }

    function _autoIncTokenId() internal returns(uint256)
    {
    	autoTokenId = autoTokenId + 1;
    	return autoTokenId;
    }

    function mint(address to) public onlyOwner
    {
    	return _mint(to, _autoIncTokenId());
    }

	function onERC721Received(address, address, uint256, bytes calldata) public virtual override returns (bytes4)
	{
		return this.onERC721Received.selector;
	}
} 
 
