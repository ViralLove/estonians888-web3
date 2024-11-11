// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IEstonians888NFT
 * @dev Interface for NFT contracts to support custom logic on sale events.
 */
interface IEstonians888NFT {
    /**
     * @notice Called when the NFT is sold through the marketplace.
     * @param buyer Address of the buyer.
     * @param tokenId ID of the token being sold.
     */
    function onNFTSold(address buyer, uint256 tokenId) external;
}
