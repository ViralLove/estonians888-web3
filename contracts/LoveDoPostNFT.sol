// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";     // For royalty support
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";    // Новый путь
import "@openzeppelin/contracts/utils/Multicall.sol";          // For multicall functionality

import "./Estonians888Token.sol"; // Import the Estonians888Token contract
import "./IEstonians888DIDRegistry.sol"; // Добавить этот импорт

/**
 * @title LoveDoPostNFT
 * @dev Contract for creating NFT posts, supporting superlikes, and tracking given and received superlikes per user with DID.
 * Each post is represented as an NFT and linked to superlike functionality.
 */
contract LoveDoPostNFT is ERC721, Ownable, ERC2981, ReentrancyGuard, Multicall {

    using SafeERC20 for IERC20;
    using Address for address;

    Estonians888Token public immutable token; // Token used for superlikes
    //IEstonians888DIDRegistry public profileContract;

    uint256 public constant SUPERLIKE_LIMIT = 8; // Monthly superlike limit per user
    uint256 public constant RECOMMENDATION_LIMIT = 8; // Maximum recommendations with superlikes per user

    struct Post {
        address author;          // Address of the post author
        address valueProvider;   // Address of the value provider for this post
        uint256 timestamp;       // Timestamp when the post was created
        string contentURI;       // URI pointing to JSON with post content, media and tags
        bool isActive;           // The active status of the post
        address[] superlikeAddresses;  // List of addresses that gave superlikes
    }

    // NOTE: user=address

    mapping(uint256 => Post) public posts;                    // Posts by unique ID (also the NFT tokenId)
    mapping(address => string) public addressToDID;           // Mapping for address to profile DID association
    mapping(string => address) public didToAddress;           // Mapping for DID to address association
    mapping(address => uint256[]) public valueProviderToPosts;   // Mapping valueProvider to all (+other) LoveDo posts about it
    mapping(address => uint256) public userSuperlikeCount;     // Monthly counter for superlikes given by each user
    mapping(address => uint256) public lastSuperlikeReset;     // Timestamp of the last reset of the user's superlike counter
    mapping(address => uint256) public receivedSuperlikes;     // Total superlikes received by each user
    mapping(address => uint256) public givenSuperlikes;        // Total superlikes given by each user
    mapping(address => uint256) public recommendationsCount;    // Tracks the number of superliked recommendations (LoveDoPostNFT with at least one superlike) for each user
    mapping(address => uint256) public pendingWithdrawals;     // Tracks tokens each user can withdraw by DID

    uint256 public postCounter; // Counter for post NFTs

    event PostCreated(uint256 indexed postId, address indexed author, address indexed valueProvider, uint256 timestamp, string contentURI);
    event SuperlikeGiven(uint256 indexed postId, address indexed superlikeGiver, address indexed valueProvider, uint256 timestamp);
    event WithdrawalRequested(address indexed user, uint256 amount);

    struct Transaction {          // Structure to store transaction data
        uint256 timestamp;
        uint256 amount;
        address user;
    }


    /**
     * @dev Initializes the ERC721 with a name and symbol, and sets the token for superlikes.
     * @param _token Address of the Estonians888Token contract.
     */
    constructor(Estonians888Token _token) ERC721("LoveDoPostNFT", "LDP") {
        require(address(_token).code.length > 0, "Token address must be a contract.");
        token = _token;
        //profileContract = IEstonians888DIDRegistry(_profileContract);
        _setDefaultRoyalty(msg.sender, 888); // Sets default royalty to 8.88%
    }

    /**
     * @notice Sets the address associated with a given DID.
     * @dev This function links a DID to an Ethereum address.
     * @param did The DID of the user.
     * @param userAddress The Ethereum address to associate with the DID.
     */
    function setDIDAddress(string calldata did, address userAddress) private {
        require(userAddress != address(0), "Invalid address");
        // Adding the ability to link DID to an address
        didToAddress[did] = userAddress;
    }

    /**
     * @notice Creates a new post and mints a new NFT representing the post.
     * @param valueProvider Address of the value provider for this post
     * @param contentURI URI pointing to JSON with post content, media and tags
     */
    function createPost(
        address valueProvider,
        string calldata contentURI
    ) external {
        require(valueProvider != address(0), "Value provider address cannot be zero");
        
        uint256 postId = postCounter++;


        posts[postId] = Post({
            author: msg.sender,
            valueProvider: valueProvider,
            timestamp: block.timestamp,
            contentURI: contentURI,
            isActive: true,
            superlikeAddresses: new address[](0)
        });

        _mint(msg.sender, postId);

        emit PostCreated(
            postId, 
            msg.sender, 
            valueProvider, 
            block.timestamp, 
            contentURI
        );
    }

    /**
     * @notice Gives a superlike to a post by address.
     * @param postId ID of the post to superlike.
     */
    function giveSuperlike(uint256 postId) external {
        require(_exists(postId), "Post does not exist.");
        Post storage post = posts[postId];
        require(msg.sender != post.author, "Author cannot superlike own post.");

        _resetSuperlikeCount(msg.sender);

        require(userSuperlikeCount[msg.sender] < SUPERLIKE_LIMIT, "Monthly superlike limit reached.");

        // If this is the first superlike for the post, increase recommendation count for the recommended user
        if (post.superlikeAddresses.length == 0) {
            recommendationsCount[post.valueProvider]++;
        }

        // Update post, user data, and superlike mappings
        post.superlikeAddresses.push(msg.sender);

        // Superlike counter which is monthly reset for the sender user
        userSuperlikeCount[msg.sender]++;

        // Total superlikes received by the value provider
        receivedSuperlikes[post.valueProvider]++;

        // Total superlikes given by the sender user
        givenSuperlikes[msg.sender]++;

        // Update pending withdrawal balance for the value provider user
        pendingWithdrawals[post.valueProvider] += 1 ether; // Assumes 1 ether = 1 token with 18 decimals

        emit SuperlikeGiven(postId, msg.sender, post.valueProvider, block.timestamp);
    }

    /**
     * @notice Allows users to withdraw tokens they have accumulated from received superlikes.
     * Users pay gas fees to withdraw tokens. Ensures they can’t withdraw more than their accumulated balance.
     * @param amount The amount of tokens to withdraw (in smallest token units).
     */
    function withdrawTokens(uint256 amount) external nonReentrant {
        require(pendingWithdrawals[msg.sender] >= amount, "Insufficient balance to withdraw.");
    
        // Reduce the pending balance before transferring
        pendingWithdrawals[msg.sender] -= amount;
    
        // Transfer tokens from the pool in the token contract to the user
        token.transferFromPool(msg.sender, amount);
    
        emit WithdrawalRequested(msg.sender, amount);
    }


    /**
     * @dev Resets the monthly superlike counter for a user if a new month has started.
     * @param userAddress Address of the user.
     */
    function _resetSuperlikeCount(address userAddress) internal {
        uint256 oneMonth = 30 days;
        if (block.timestamp - lastSuperlikeReset[userAddress] >= oneMonth) {
            userSuperlikeCount[userAddress] = 0;
            lastSuperlikeReset[userAddress] = block.timestamp;
        }
    }

    /**
     * @notice Retrieves the list of DIDs that gave superlikes to a post.
     * @param postId ID of the post to retrieve superlikes for.
     * @return Addresses that gave superlikes.
     */
    function getSuperlikes(uint256 postId) external view returns (address[] memory) {
        require(_exists(postId), "Post does not exist.");
        return posts[postId].superlikeAddresses;
    }

    /**
     * @notice Returns the total superlikes received by a specific DID.
     * This can be used as a social mining metric for user rating.
     * @param userAddress Address of the user.
     * @return Total superlikes received by the user.
     */
    function getReceivedSuperlikes(address userAddress) external view returns (uint256) {
        return receivedSuperlikes[userAddress];
    }

    /**
     * @notice Returns the total superlikes given by a specific DID.
     * @param userAddress Address of the user.
     * @return Total superlikes given by the user.
     */
    function getGivenSuperlikes(address userAddress) external view returns (uint256) {
        return givenSuperlikes[userAddress];
    }

    /**
     * @notice Returns the amount of tokens the user can withdraw.
     * @param userAddress Address of the user.
     * @return Amount of tokens available for withdrawal.
     */
    function getPendingWithdrawals(address userAddress) external view returns (uint256) {
        return pendingWithdrawals[userAddress];
    }

    /**
    * @dev Returns whether `tokenId` exists.
    * Tokens exist if they have an owner.
    */
    function _exists(uint256 tokenId) internal view override returns (bool) {
        return (ownerOf(tokenId) != address(0));
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, ERC2981) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

}