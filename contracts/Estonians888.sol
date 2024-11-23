// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./IEstonians888NFT.sol";
/**
 * @title Estonians888
 * @dev NFT collection contract with royalty support based on ERC721 standard and additional extensions.
 */
contract Estonians888 is ERC721, ERC721Enumerable, ERC721URIStorage, ERC2981, Ownable {
    
    IERC20 public estoToken; // $ESTO token for payment
    uint256 private _tokenIdCounter;

    // Mapping to store the price for each NFT
    mapping(uint256 => uint256) public nftPrices;

    event NFTSold(address indexed buyer, uint256 indexed tokenId);

    /**
     * @dev Sets up the collection name, symbol, royalty information, and owner of the contract.
     * @param _royaltyFeesInBips Royalty fee in basis points (1% = 100 basis points).
     */
    constructor(uint96 _royaltyFeesInBips) ERC721("Estonians888", "EST888") {
        _setDefaultRoyalty(msg.sender, _royaltyFeesInBips);
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

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal virtual override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }

    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        super._burn(tokenId);
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
        override(ERC721, ERC721Enumerable, ERC721URIStorage, ERC2981)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    /**
    * @notice Sets the price for a specific NFT in $ESTO tokens
    * @param tokenId The ID of the NFT
    * @param price The price in $ESTO tokens
    */
    function setNFTPrice(uint256 tokenId, uint256 price) external onlyOwner {
        nftPrices[tokenId] = price;
    }

    /**
    * @notice Retrieves the price of a specific NFT
    * @param tokenId The ID of the NFT
    * @return The price in $ESTO tokens
    */
    function getNFTPrice(uint256 tokenId) external view returns (uint256) {
        return nftPrices[tokenId];
    }


    function buyNFT(uint256 tokenId) external {
        uint256 price = nftPrices[tokenId];
        require(price > 0, "NFT not for sale");
        
        // Ensure the buyer has approved enough $ESTO tokens for this contract
        require(estoToken.allowance(msg.sender, address(this)) >= price, "Marketplace not approved for $ESTO");

        // Transfer $ESTO tokens from the buyer to the contract owner (seller)
        require(estoToken.transferFrom(msg.sender, owner(), price), "Failed to transfer $ESTO");

        // Transfer NFT to the buyer
        _safeTransfer(owner(), msg.sender, tokenId, "");

        // Check if the NFT supports IEstonians888NFT, then call onNFTSold
        if (IERC165(address(this)).supportsInterface(type(IEstonians888NFT).interfaceId)) {
            IEstonians888NFT(address(this)).onNFTSold(msg.sender, tokenId);
        }

        emit NFTSold(msg.sender, tokenId);
    }

}