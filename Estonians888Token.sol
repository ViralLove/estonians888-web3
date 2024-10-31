// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Estonians888Token ($ESTO)
 * @dev ERC20 Token with controlled issuance, named "Estonians888" with the symbol "ESTO".
 * The contract includes mechanisms for minting, burning, and transferring tokens from an issuance pool.
 */
contract Estonians888Token is ERC20, Ownable {

    uint256 public constant INITIAL_SUPPLY = 88_888_888 ether; // Total supply with 18 decimals
    uint256 public circulatingSupply; // Tracks the circulating supply
    uint256 public remainingPool; // Tracks remaining balance in issuance pool
    bool public isMintable = true; // Minting enabled/disabled flag

    event Mint(address indexed to, uint256 amount);
    event Burn(address indexed from, uint256 amount);

    /**
     * @dev Constructor initializes the token with the name "Estonians888" and symbol "ESTO",
     * allocates the initial supply to the contract itself for controlled issuance.
     */
    constructor() ERC20("Estonians888", "ESTO") Ownable(msg.sender) {
        remainingPool = INITIAL_SUPPLY;
        circulatingSupply = 0;

        // Initial supply is allocated to the contract itself for controlled issuance
        _mint(address(this), INITIAL_SUPPLY);
    }

    /**
     * @notice Mint tokens by transferring from the issuance pool to a specified address.
     * @dev Can only be called by the owner and if minting is enabled.
     * @param to The address to mint (send tokens) to.
     * @param amount The amount of tokens to mint.
     */
    function mint(address to, uint256 amount) external onlyOwner {
        require(isMintable, "Minting is disabled");
        require(remainingPool >= amount, "Not enough tokens in issuance pool");

        remainingPool -= amount;
        circulatingSupply += amount;

        _transfer(address(this), to, amount); // Transfer from issuance pool to recipient
        emit Mint(to, amount);
    }

    /**
     * @notice Burns (removes) tokens by reducing the circulating supply and adding back to issuance pool.
     * @dev Can only be called by the owner.
     * @param amount The amount of tokens to burn.
     */
    function burn(uint256 amount) external onlyOwner {
        require(circulatingSupply >= amount, "Burn amount exceeds circulating supply");

        circulatingSupply -= amount;
        remainingPool += amount;

        _burn(msg.sender, amount);
        emit Burn(msg.sender, amount);
    }

    /**
     * @notice Transfers tokens from the issuance pool to a specified address.
     * @param to The address to receive the token.
     * @param amount The amount of tokens to transfer.
     */
    function transferFromPool(address to, uint256 amount) external onlyOwner {
        require(remainingPool >= amount, "Not enough tokens in issuance pool");

        remainingPool -= amount;
        circulatingSupply += amount;

        _transfer(address(this), to, amount); // Transfer from issuance pool to recipient
    }

    /**
     * @notice Disable minting of tokens permanently.
     * @dev Can only be called by the owner.
     */
    function disableMinting() external onlyOwner {
        isMintable = false;
    }

    /**
     * @notice Withdraw any remaining tokens in the contract to the owner.
     */
    function withdraw() external onlyOwner {
        uint256 balance = balanceOf(address(this));
        require(balance > 0, "No tokens to withdraw");
        _transfer(address(this), owner(), balance);
    }
}
