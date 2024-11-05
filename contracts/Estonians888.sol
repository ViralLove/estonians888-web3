// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Estonians888
 * @dev NFT collection contract with royalty support based on ERC721 standard and additional extensions.
 */
contract Estonians888 is ERC721, ERC721Enumerable, ERC721URIStorage, ERC2981, Ownable {
    
    uint256 private _tokenIdCounter;

    /**
     * @dev Sets up the collection name, symbol, royalty information, and owner of the contract.
     * @param _royaltyFeesInBips Royalty fee in basis points (1% = 100 basis points).
     * @param _owner Address of the contract owner.
     */
    constructor(uint96 _royaltyFeesInBips, address _owner) ERC721("Estonians888", "EST888") Ownable(_owner) {
        setRoyaltyInfo(_owner, _royaltyFeesInBips);
        transferOwnership(_owner);
    }

    /**
     * @notice Mints a new NFT with a unique tokenId and URI.
     * @dev Requires a unique tokenId for each new token.
     * @param to Address of the recipient of the token.
     * @param tokenId Unique identifier of the token.
     * @param uri URI for the token's metadata.
     */
    function safeMint(address to, uint256 tokenId, string memory uri) public {
        require(_ownerOf(tokenId) == address(0), "This token ID already exists!");
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    /**
     * @notice Sets royalty information.
     * @dev Only the owner can call this function.
     * @param _receiver Address of the royalty recipient.
     * @param _royaltyFeesInBips Royalty percentage in basis points.
     */
    function setRoyaltyInfo(address _receiver, uint96 _royaltyFeesInBips) public onlyOwner {
        _setDefaultRoyalty(_receiver, _royaltyFeesInBips);
    }

    // Overridden functions from inherited contracts.

    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC2981, ERC721Enumerable, ERC721URIStorage, ERC721)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}