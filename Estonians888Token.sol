// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./Estonians888Token.sol"; // Import the Estonians888Token contract

/**
 * @title LoveDoPostNFT
 * @dev Contract for creating NFT posts, supporting superlikes, and tracking given and received superlikes per user.
 * Each post is represented as an NFT and linked to superlike functionality.
 */
contract LoveDoPostNFT is ERC721, Ownable {
    using SafeERC20 for IERC20;
    using Address for address;

    Estonians888Token public immutable token; // Token used for superlikes
    uint256 public constant SUPERLIKE_LIMIT = 8; // Monthly superlike limit per user

    struct Post {
        address author;       // Address of the post author
        address recommended;  // Address of the person the post is about
        uint256 timestamp;    // Timestamp when the post was created
        string mediaURI;      // URI for media content
        string content;       // Formatted text (markdown)
        address[] superlikes; // List of addresses that gave superlikes
    }

    mapping(uint256 => Post) public posts;                // Posts by unique ID (also the NFT tokenId)
    mapping(address => uint256) public userSuperlikeCount; // Monthly counter for superlikes given by each user
    mapping(address => uint256) public lastSuperlikeReset; // Timestamp of the last reset of the user's superlike counter
    mapping(address => uint256) public receivedSuperlikes; // Total superlikes received by each user
    mapping(address => uint256) public givenSuperlikes;    // Total superlikes given by each user
    mapping(address => uint256) public pendingWithdrawals; // Tracks tokens user can withdraw

    uint256 public postCounter; // Counter for post IDs

    event PostCreated(uint256 indexed postId, address indexed author, address indexed recommended, uint256 timestamp, string mediaURI, string content);
    event SuperlikeGiven(uint256 indexed postId, address indexed superlikeGiver, address indexed recommended, uint256 timestamp);
    event WithdrawalRequested(address indexed user, uint256 amount);

    /**
     * @dev Initializes the ERC721 with a name and symbol, and sets the token for superlikes.
     * @param _token Address of the Estonians888Token contract.
     */
    constructor(Estonians888Token _token) ERC721("LoveDoPostNFT", "LDP") {
        require(address(_token).code.length > 0, "Token address must be a contract.");
        token = _token;
    }

    /**
     * @notice Creates a new post with a recommendation and mints a new NFT representing the post.
     * @param recommended Address of the person the post is about.
     * @param mediaURI URI for media content stored on IPFS.
     * @param content Formatted text of the post (markdown).
     */
    function createPost(address recommended, string calldata mediaURI, string calldata content) external {
        require(recommended != address(0), "Recommended address cannot be zero.");
        
        uint256 postId = postCounter++;
        posts[postId] = Post({
            author: msg.sender,
            recommended: recommended,
            timestamp: block.timestamp,
            mediaURI: mediaURI,
            content: content,
            superlikes: new address 
        });

        _mint(msg.sender, postId);

        emit PostCreated(postId, msg.sender, recommended, block.timestamp, mediaURI, content);
    }

    /**
     * @notice Gives a superlike to a post. Updates mappings for given and received superlikes
     * and tracks the amount of tokens the recommended person can withdraw.
     * @param postId ID of the post to superlike.
     */
    function giveSuperlike(uint256 postId) external {
        require(_exists(postId), "Post does not exist.");
        Post storage post = posts[postId];
        require(msg.sender != post.author, "Author cannot superlike own post.");

        // Check and reset superlike counter if the month has changed
        _resetSuperlikeCount(msg.sender);

        // Ensure the user has not exceeded their monthly superlike limit
        require(userSuperlikeCount[msg.sender] < SUPERLIKE_LIMIT, "Monthly superlike limit reached.");

        // Update post, user data, and superlike mappings
        post.superlikes.push(msg.sender);
        userSuperlikeCount[msg.sender]++;
        receivedSuperlikes[post.recommended]++;
        givenSuperlikes[msg.sender]++;

        // Update pending withdrawal balance for the recommended user
        pendingWithdrawals[post.recommended] += 1 ether; // Assumes 1 ether = 1 token with 18 decimals

        emit SuperlikeGiven(postId, msg.sender, post.recommended, block.timestamp);
    }

    /**
     * @notice Allows users to withdraw tokens they have accumulated from received superlikes.
     * Users pay gas fees to withdraw tokens. Ensures they can't withdraw more than their accumulated balance.
     * @param amount The amount of tokens to withdraw (in smallest token units).
     */
    function withdrawTokens(uint256 amount) external {
        require(pendingWithdrawals[msg.sender] >= amount, "Insufficient balance to withdraw.");

        // Reduce the pending balance and transfer tokens
        pendingWithdrawals[msg.sender] -= amount;
        token.transfer(msg.sender, amount);

        emit WithdrawalRequested(msg.sender, amount);
    }

    /**
     * @dev Resets the monthly superlike counter for a user if a new month has started.
     * @param user Address of the user.
     */
    function _resetSuperlikeCount(address user) internal {
        uint256 oneMonth = 30 days;
        if (block.timestamp - lastSuperlikeReset[user] >= oneMonth) {
            userSuperlikeCount[user] = 0;
            lastSuperlikeReset[user] = block.timestamp;
        }
    }

    /**
     * @notice Retrieves the list of addresses that gave superlikes to a post.
     * @param postId ID of the post to retrieve superlikes for.
     * @return Addresses that gave superlikes.
     */
    function getSuperlikes(uint256 postId) external view returns (address[] memory) {
        require(_exists(postId), "Post does not exist.");
        return posts[postId].superlikes;
    }

    /**
     * @notice Returns the total superlikes received by a specific user.
     * This can be used as a social mining metric for user rating.
     * @param user Address of the user.
     * @return Total superlikes received by the user.
     */
    function getReceivedSuperlikes(address user) external view returns (uint256) {
        return receivedSuperlikes[user];
    }

    /**
     * @notice Returns the total superlikes given by a specific user.
     * @param user Address of the user.
     * @return Total superlikes given by the user.
     */
    function getGivenSuperlikes(address user) external view returns (uint256) {
        return givenSuperlikes[user];
    }

    /**
     * @notice Returns the amount of tokens the user can withdraw.
     * @param user Address of the user.
     * @return Amount of tokens available for withdrawal.
     */
    function getPendingWithdrawals(address user) external view returns (uint256) {
        return pendingWithdrawals[user];
    }
}
