// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

import "./Estonians888Token.sol"; // Импортируем контракт Estonians888Token

contract LoveDoPostNFT is ERC721, Ownable {
    using SafeERC20 for IERC20;
    using Address for address;

    Estonians888Token public immutable token; // Токен для суперлайков
    uint256 public constant SUPERLIKE_LIMIT = 8; // Лимит суперлайков на пользователя в месяц

    struct Post {
        address author;       // Адрес автора поста
        address recommended;  // Адрес человека, о котором пост
        uint256 timestamp;    // Время создания поста
        string mediaURI;      // URI для медиа контента
        string content;       // Отформатированный текст (markdown)
        address[] superlikes; // Список адресов, которые дали суперлайки
    }

    mapping(uint256 => Post) public posts;           // Посты по уникальному ID (также tokenId для NFT)
    mapping(address => uint256) public userSuperlikeCount; // Счётчик суперлайков на пользователя
    mapping(address => uint256) public lastSuperlikeReset; // Время последнего сброса счётчика суперлайков

    uint256 public postCounter; // Счётчик постов

    event PostCreated(uint256 indexed postId, address indexed author, address indexed recommended, uint256 timestamp, string mediaURI, string content);
    event SuperlikeGiven(uint256 indexed postId, address indexed superlikeGiver, address indexed recommended, uint256 timestamp);
    event TokenSent(address indexed from, address indexed to, uint256 amount);

    constructor(Estonians888Token _token) ERC721("LoveDoPostNFT", "LDP") {
        require(address(_token).code.length > 0, "Token address must be a contract.");
        token = _token;
    }

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

    function giveSuperlike(uint256 postId) external {
        require(_exists(postId), "Post does not exist.");
        Post storage post = posts[postId];
        require(msg.sender != post.author, "Author cannot superlike own post.");

        // Сбрасываем счётчик суперлайков, если прошёл месяц
        _resetSuperlikeCount(msg.sender);

        // Проверяем, что пользователь не превысил лимит суперлайков
        require(userSuperlikeCount[msg.sender] < SUPERLIKE_LIMIT, "Monthly superlike limit reached.");

        // Обновляем данные поста и пользователя
        post.superlikes.push(msg.sender);
        userSuperlikeCount[msg.sender]++;

        // Переводим токен человеку, о котором пост
        token.transferFromPool(post.recommended, 1 ether); // Предполагаем, что 1 ether = 1 токен с 18 знаками

        emit SuperlikeGiven(postId, msg.sender, post.recommended, block.timestamp);
        emit TokenSent(address(this), post.recommended, 1 ether);
    }

    function _resetSuperlikeCount(address user) internal {
        uint256 oneMonth = 30 days;
        if (block.timestamp - lastSuperlikeReset[user] >= oneMonth) {
            userSuperlikeCount[user] = 0;
            lastSuperlikeReset[user] = block.timestamp;
        }
    }

    function getSuperlikes(uint256 postId) external view returns (address[] memory) {
        require(_exists(postId), "Post does not exist.");
        return posts[postId].superlikes;
    }
}
