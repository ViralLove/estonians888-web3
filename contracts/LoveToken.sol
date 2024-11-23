// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * @title LoveToken
 * @dev ERC20 token representing $LOVE, a non-transferable token for internal ecosystem use.
 * Includes functionality for managing exchange rates with community tokens.
 * Exchange rates are stored for bi-directional conversions and include metadata for future scalability
 * across parachains or bridges to other networks.
 */
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

contract LoveToken is ERC20Burnable {
    /// @notice Mapping to store exchange rates between $LOVE and other tokens
    mapping(address => uint256) public loveToTokenRate; // LOVE -> Other Token
    mapping(address => uint256) public tokenToLoveRate; // Other Token -> LOVE

    /// @notice Mapping to store the addresses of other tokens by their symbols
    /// @notice tokenAddresses could later support mappings for tokens across multiple networks through parachains and bridges
    mapping(string => address) public tokenAddresses; 

    /// @notice Array to store the symbols of tokens for metadata purposes
    string[] public tokenSymbols = ["ESTO"];

    /// @notice Address of the contract owner
    address public owner;

    event TokenAdded(string tokenSymbol, address tokenAddress);
    event ExchangeRateUpdated(address tokenAddress, uint256 loveToToken, uint256 tokenToLove);

    /**
     * @dev Modifier to restrict functions to the contract owner.
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can call this function");
        _;
    }

    /**
     * @dev Initializes the contract by setting up the initial supply and assigning it to the owner.
     * @param _owner The address of the contract owner.
     */
    constructor(address _owner) ERC20("LOVE Token", "LOVE") {
        require(_owner != address(0), "Owner address cannot be zero");
        owner = _owner;
        _mint(_owner, 8_888_888_888 * 10**decimals()); // Initial supply of 8,888,888,888 tokens
    }

    /**
     * @dev Adds a new token with its symbol, address, and exchange rates to the mapping.
     * @param tokenSymbol The symbol of the new token (e.g., "ESTO").
     * @param tokenAddress The contract address of the new token.
     */
    function addToken(
        string memory tokenSymbol,
        address tokenAddress
    ) external onlyOwner {
        require(tokenAddresses[tokenSymbol] == address(0), "Token already exists");
        require(tokenAddress != address(0), "Token address cannot be zero");

        tokenAddresses[tokenSymbol] = tokenAddress;
        tokenSymbols.push(tokenSymbol);
    }

    /**
     * @dev Updates the exchange rates for an existing token.
     * @param tokenAddress The address of the token to update.
     * @param loveToToken The new exchange rate from $LOVE to the token.
     * @param tokenToLove The new exchange rate from the token to $LOVE.
     */
    function updateExchangeRates(
        address tokenAddress,
        uint256 loveToToken,
        uint256 tokenToLove
    ) external onlyOwner {
        require(tokenAddress != address(0), "Token does not exist");
        require(loveToToken > 0, "Exchange rate must be positive");
        require(tokenToLove > 0, "Exchange rate must be positive");
        loveToTokenRate[tokenAddress] = loveToToken;
        tokenToLoveRate[tokenAddress] = tokenToLove;
    }

    /**
     * @dev Fetches the total number of tokens added to the exchange system.
     * @return The total number of token symbols stored.
     */
    function getTokenCount() external view returns (uint256) {
        return tokenSymbols.length;
    }

    /**
     * @dev Fetches the token symbol and address at a given index in the list of added tokens.
     * @param index The index of the token in the array.
     * @return tokenSymbol The symbol of the token.
     * @return tokenAddress The address of the token.
     */
    function getTokenByIndex(uint256 index)
        external
        view
        returns (string memory tokenSymbol, address tokenAddress)
    {
        require(index < tokenSymbols.length, "Index out of bounds");
        tokenSymbol = tokenSymbols[index];
        tokenAddress = tokenAddresses[tokenSymbol];
    }

    /**
     * @dev Burns tokens. This overrides the ERC20Burnable burn functionality to limit its use to internal purposes.
     * The burn function is limited to the owner but can be further enhanced by logging burn events for better tracking.
     * @param amount The amount of tokens to burn.
     */
    function burn(uint256 amount) public override onlyOwner {
        super.burn(amount);
    }

    function transfer(address, uint256) public pure override returns (bool) {
        revert("Transfer not allowed");
    }

    function approve(address, uint256) public pure override returns (bool) {
        revert("Approve not allowed");
    }

}
