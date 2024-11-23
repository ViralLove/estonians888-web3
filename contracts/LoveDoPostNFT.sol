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
        string authorDID;        // DID of the author
        string recommendedDID;   // DID of the recommended user
        uint256 timestamp;       // Timestamp when the post was created
        string mediaURI;         // URI for media content
        string content;          // Formatted text (markdown)
        string[] tags;           // An array of service/product descriptive (hash)tags
        bool isActive;           // The active status of the post
        string[] superlikeDIDs;  // List of DIDs that gave superlikes
    }

    mapping(uint256 => Post) public posts;                    // Posts by unique ID (also the NFT tokenId)
    mapping(string => address) public didToAddress;           // Mapping for DID to address association
    mapping(string => uint256[]) public recommendedToPosts;   // Mapping recommendedDID (value provider) to all (+other) LoveDo posts about it
    mapping(string => uint256) public userSuperlikeCount;     // Monthly counter for superlikes given by each DID
    mapping(string => uint256) public lastSuperlikeReset;     // Timestamp of the last reset of the user's superlike counter
    mapping(string => uint256) public receivedSuperlikes;     // Total superlikes received by each DID
    mapping(string => uint256) public givenSuperlikes;        // Total superlikes given by each DID
    mapping(string => uint256) public recommendationCount;    // Tracks the number of superliked recommendations for each DID
    mapping(string => uint256) public pendingWithdrawals;     // Tracks tokens each user can withdraw by DID

    uint256 public postCounter; // Counter for post IDs

    event PostCreated(uint256 indexed postId, address indexed author, string authorDID, string recommendedDID, uint256 timestamp, string mediaURI, string content);
    event SuperlikeGiven(uint256 indexed postId, string indexed superlikeGiverDID, string indexed recommendedDID, uint256 timestamp);
    event WithdrawalRequested(address indexed user, uint256 amount);

    mapping(string => uint256[]) public tagToPosts; // Mapping of tags to post IDs for tag-based grouping
    mapping(uint256 => uint256) public postInteractions; // Counts interactions for each post
    mapping(uint256 => address[]) public postViewers;    // Stores unique viewers for each post
    mapping(uint256 => Transaction[]) public postTransactions; // Transaction history for each post
    mapping(string => uint256) public postEarnings;      // Tracks earnings for each DID

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
     * @notice Creates a new post with a recommendation and mints a new NFT representing the post.
     * Enforces that the recommended user has not exceeded the recommendation limit.
     * @param authorDID DID of the author of the post.
     * @param recommendedDID DID of the person the post is about.
     * @param mediaURI URI for media content stored on IPFS.
     * @param content Formatted text of the post (markdown).
     */
    function createPost(string calldata authorDID, string calldata recommendedDID, string calldata mediaURI, string calldata content, string[] calldata tags) external {
        require(bytes(recommendedDID).length > 0, "Recommended DID cannot be empty.");

        require(recommendationCount[recommendedDID] < RECOMMENDATION_LIMIT, "User has reached maximum recommendations.");

        uint256 postId = postCounter++;
        posts[postId] = Post({
            author: msg.sender,
            authorDID: authorDID,
            recommendedDID: recommendedDID,
            timestamp: block.timestamp,
            mediaURI: mediaURI,
            content: content,
            tags: tags, // Initialize an empty array for tags
            isActive: true,       // Set initial status to active
            superlikeDIDs: new string[](0)   // Initialize an empty array of superlike DIDs
        });

        for (uint256 i = 0; i < tags.length; i++) {
            tagToPosts[tags[i]].push(postId);
        }


        _mint(msg.sender, postId);

        setDIDAddress(authorDID, msg.sender);

        emit PostCreated(postId, msg.sender, authorDID, recommendedDID, block.timestamp, mediaURI, content);
    }

    /**
     * @notice Gives a superlike to a post by DID.
     * @param postId ID of the post to superlike.
     * @param giverDID DID of the user giving the superlike.
     */
    function giveSuperlike(uint256 postId, string calldata giverDID) external {
        require(_exists(postId), "Post does not exist.");
        Post storage post = posts[postId];
        require(keccak256(bytes(giverDID)) != keccak256(bytes(post.authorDID)), "Author cannot superlike own post.");

        _resetSuperlikeCount(giverDID);

        require(userSuperlikeCount[giverDID] < SUPERLIKE_LIMIT, "Monthly superlike limit reached.");

        // If this is the first superlike for the post, increase recommendation count for the recommended user
        if (post.superlikeDIDs.length == 0) {
            recommendationCount[post.recommendedDID]++;
        }

        // Update post, user data, and superlike mappings
        post.superlikeDIDs.push(giverDID);
        userSuperlikeCount[giverDID]++;
        receivedSuperlikes[post.recommendedDID]++;
        givenSuperlikes[giverDID]++;

        setDIDAddress(giverDID, msg.sender);

        // Update pending withdrawal balance for the recommended user
        pendingWithdrawals[post.recommendedDID] += 1 ether; // Assumes 1 ether = 1 token with 18 decimals

        emit SuperlikeGiven(postId, giverDID, post.recommendedDID, block.timestamp);
    }

    /**
     * @notice Allows users to withdraw tokens they have accumulated from received superlikes.
     * Users pay gas fees to withdraw tokens. Ensures they can’t withdraw more than their accumulated balance.
     * @param amount The amount of tokens to withdraw (in smallest token units).
     */
    function withdrawTokens(uint256 amount, string calldata userDID) external nonReentrant {
        require(pendingWithdrawals[userDID] >= amount, "Insufficient balance to withdraw.");
    
        // Reduce the pending balance before transferring
        pendingWithdrawals[userDID] -= amount;
    
        // Получаем адрес пользователя, связанный с DID
        address userAddress = didToAddress[userDID];
        require(userAddress != address(0), "DID not linked to any address");
    
        // Transfer tokens from the pool in the token contract to the user
        token.transferFromPool(userAddress, amount);
    
        emit WithdrawalRequested(userAddress, amount);
    }


    /**
     * @dev Resets the monthly superlike counter for a user if a new month has started.
     * @param giverDID DID of the user.
     */
    function _resetSuperlikeCount(string memory giverDID) internal {
        uint256 oneMonth = 30 days;
        if (block.timestamp - lastSuperlikeReset[giverDID] >= oneMonth) {
            userSuperlikeCount[giverDID] = 0;
            lastSuperlikeReset[giverDID] = block.timestamp;
        }
    }

    /**
     * @notice Retrieves the list of DIDs that gave superlikes to a post.
     * @param postId ID of the post to retrieve superlikes for.
     * @return DIDs that gave superlikes.
     */
    function getSuperlikes(uint256 postId) external view returns (string[] memory) {
        require(_exists(postId), "Post does not exist.");
        return posts[postId].superlikeDIDs;
    }

    /**
     * @notice Returns the total superlikes received by a specific DID.
     * This can be used as a social mining metric for user rating.
     * @param userDID DID of the user.
     * @return Total superlikes received by the user.
     */
    function getReceivedSuperlikes(string memory userDID) external view returns (uint256) {
        return receivedSuperlikes[userDID];
    }

    /**
     * @notice Returns the total superlikes given by a specific DID.
     * @param userDID DID of the user.
     * @return Total superlikes given by the user.
     */
    function getGivenSuperlikes(string memory userDID) external view returns (uint256) {
        return givenSuperlikes[userDID];
    }

    /**
     * @notice Returns the amount of tokens the user can withdraw.
     * @param userDID DID of the user.
     * @return Amount of tokens available for withdrawal.
     */
    function getPendingWithdrawals(string memory userDID) external view returns (uint256) {
        return pendingWithdrawals[userDID];
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