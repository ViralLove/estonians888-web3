// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Estonians888Token ($ESTO)
 * @dev ERC20 Token with an initial supply and controlled minting functionality.
 */
contract Estonians888Token is ERC20, Ownable {

    uint256 public constant INITIAL_SUPPLY = 88_888_888 ether; // Initial supply with 18 decimals
    uint256 public remainingPool; // Tracks remaining balance in issuance pool
    bool public isMintable = true; // Minting enabled/disabled flag

    /**
     * @dev Constructor initializes the token with the name "Estonians888" and symbol "ESTO",
     * allocating the initial supply to the contract itself for controlled issuance.
     */
    constructor() ERC20("Estonians888", "ESTO") Ownable(msg.sender){
        remainingPool = INITIAL_SUPPLY;

        // Initial supply allocated to the contract for controlled issuance
        _mint(address(this), INITIAL_SUPPLY);
    }

    /**
     * @notice Mints additional tokens to a specified address, if minting is enabled.
     * @dev Only callable by the owner.
     * @param to The address to receive the minted tokens.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(isMintable, "Minting is disabled");
        
        remainingPool += amount; // Increase remaining pool with the minted tokens
        _mint(to, amount); // Mint the specified amount to the recipient address
    }

    /**
     * @notice Transfers tokens from the issuance pool to a specified address.
     * @param to The address to receive the token.
     * @param amount The amount of tokens to transfer.
     */
    function transferFromPool(address to, uint256 amount) external onlyOwner {
        require(remainingPool >= amount, "Not enough tokens in issuance pool");

        remainingPool -= amount;
        _transfer(address(this), to, amount); // Transfer from issuance pool to recipient
    }

    /**
     * @notice Disable minting of tokens permanently.
     * @dev Can only be called by the owner.
     */
    function disableMinting() external onlyOwner {
        isMintable = false;
    }
}
