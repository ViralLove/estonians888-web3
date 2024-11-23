// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";


interface IEstonians888NFT {
    function balanceOf(address owner) external view returns (uint256);
}

/**
 * @title Estonians888InviteNFT
 * @dev This contract manages invitation-only access to the network by issuing invite NFTs.
 * Each InviteNFT includes a unique alpha-numeric code for activation and transfers ownership 
 * upon successful activation to the newly created user address.
 */
contract Estonians888InviteNFT is ERC721Enumerable, Ownable, IERC721Receiver, ERC721URIStorage {
    
    IEstonians888NFT public immutable estonians888NFT;

    // Mapping to store the alpha-numeric invite code for each tokenId
    mapping(uint256 => string) public inviteCodes;

    // Mapping to log which address activated the invite code
    mapping(string => address) public inviteActivator;

    // Links email to invite code
    mapping(bytes32 => string) private hashedEmailToInviteCode;
    // Tracks activation status of invite codes
    mapping(string => bool) public activatedInviteCodes;

    // Event emitted when an invite code is activated
    event InviteActivated(string inviteCode, bytes32 indexed hashedEmail, address indexed activator);

    // Counter for token IDs
    uint256 private tokenIdCounter;

    // Мапинг для отслеживания, использовал ли адрес своё право на минтинг инвайтов
    mapping(address => bool) public hasCreatedInvites;

    // Количество инвайтов, которые можно создать
    uint256 private constant INVITES_PER_USER = 8;

    // Добавить в состояние контракта:
    mapping(string => bool) public existingInviteCodes;

    // Маппинг для отслеживания верифицированных кошельков
    mapping(address => bool) public verifiedWallets;

    // Маппинги для связи email с адресом кошелька
    mapping(string => address) public emailToWallet;
    mapping(address => string) public walletToEmail;

    // Events for detailed logging
    event WalletConnectionStarted(bytes32 indexed hashedEmail, address indexed wallet);
    event InviteCodeFound(bytes32 indexed hashedEmail, string inviteCode);
    event NFTTransferInitiated(uint256 tokenId, address from, address to);
    event WalletConnected(bytes32 indexed hashedEmail, address indexed wallet, string inviteCode);

    // Добавляем в состояние контракта:
    bytes32 private immutable SALT;
    mapping(bytes32 => bool) private hashedInviteCodes;
    uint256 private constant MIN_INVITE_LENGTH = 8;
    uint256 private constant MAX_INVITE_LENGTH = 32;

    // Добавляем в состояние контракта:
    string private constant VERIFICATION_MESSAGE = "Verify wallet for Estonians888InviteNFT";
    mapping(bytes => bool) private usedSignatures;

    // Добавляем маппинги для связей
    mapping(string => address) public inviteCodeToWallet;

    // Добавляем в состояние контракта
    mapping(address => uint256) private lastCallTimestamp;
    mapping(address => uint256) private callCounter;
    uint256 private constant CALL_DELAY = 1 minutes;
    uint256 private constant MAX_CALLS_PER_PERIOD = 10;
    uint256 private constant RESET_PERIOD = 1 hours;

    /**
     * @dev Initializes the contract with the name and symbol for the InviteNFT.
     */
    constructor(address _estonians888NFT) ERC721("Estonians888InviteNFT", "E888INVITE") {
        estonians888NFT = IEstonians888NFT(_estonians888NFT);
        SALT = keccak256(abi.encodePacked(block.timestamp, msg.sender));
    }

    /**
     * @dev Mints a new InviteNFT with a unique alpha-numeric invite code.
     * Only callable by the contract owner.
     * @param to The address to which the InviteNFT will be minted.
     * @param inviteCode The unique alpha-numeric code associated with this invite NFT.
     */
    function mintInvite(address to, string memory inviteCode, string memory mintTokenURI) external onlyOwner {
        // Валидация входных данных
        require(bytes(inviteCode).length >= MIN_INVITE_LENGTH, "Invite code too short");
        require(bytes(inviteCode).length <= MAX_INVITE_LENGTH, "Invite code too long");
        require(_isValidInviteFormat(inviteCode), "Invalid invite code format");
        
        // Хэширование с salt
        bytes32 hashedCode = keccak256(abi.encodePacked(SALT, inviteCode));
        require(!hashedInviteCodes[hashedCode], "Invite code already exists");

        tokenIdCounter++;
        uint256 tokenId = tokenIdCounter;

        _safeMint(to, tokenId);
        inviteCodes[tokenId] = inviteCode;
        hashedInviteCodes[hashedCode] = true;
        existingInviteCodes[inviteCode] = true;

        _setTokenURI(tokenId, mintTokenURI);
    }

    // Добавляем вспомогательную функцию для проверки фомата:
    function _isValidInviteFormat(string memory code) private pure returns (bool) {
        bytes memory b = bytes(code);
        for(uint i; i < b.length; i++){
            bytes1 char = b[i];
            if(!(
                (char >= 0x30 && char <= 0x39) || // 0-9
                (char >= 0x41 && char <= 0x5A) || // A-Z
                (char >= 0x61 && char <= 0x7A)    // a-z
            )) return false;
        }
        return true;
    }

    /**
     * @dev Проверяет Invite-код на валидность.
     * @param inviteCode Invite-код для проверки.
     * @return isValid true, если Invite-код существует и ещё не активирован.
     */
    function validateInviteCode(string memory inviteCode) 
        external 
        rateLimiter(CALL_DELAY) 
        returns (bool isValid) 
    {
        return existingInviteCodes[inviteCode] && !activatedInviteCodes[inviteCode];
    }

    /**
     * @dev Получает информацию о лимитах вызовов для адреса
     * @param addr Адрес для проверки
     * @return remainingCalls Оставшееся количество вызовов
     * @return nextResetTime Время следующего сброса счетчика
     * @return canCallAfter ремя, когда можно сделать следующий вызов
     */
    function getRateLimitInfo(address addr) 
        external 
        view 
        returns (
            uint256 remainingCalls,
            uint256 nextResetTime,
            uint256 canCallAfter
        ) 
    {
        uint256 lastCall = lastCallTimestamp[addr];
        
        // Вычисляем оставшиеся вызовы
        uint256 remaining = MAX_CALLS_PER_PERIOD - callCounter[addr];
        if (block.timestamp >= lastCall + RESET_PERIOD) {
            remaining = MAX_CALLS_PER_PERIOD;
        }
        
        return (
            remaining,
            lastCall + RESET_PERIOD,
            lastCall + CALL_DELAY
        );
    }

    /**
     * @dev Проверяет возможность вызова метода для адреса
     * @param addr Адрес для проверки
     * @return canCall Возможность вызова
     * @return waitTime Время ожидания (если canCall = false)
     */
    function canMakeCall(address addr) 
        external 
        view 
        returns (bool canCall, uint256 waitTime) 
    {
        if (block.timestamp < lastCallTimestamp[addr] + CALL_DELAY) {
            return (false, lastCallTimestamp[addr] + CALL_DELAY - block.timestamp);
        }
        
        if (callCounter[addr] >= MAX_CALLS_PER_PERIOD && 
            block.timestamp < lastCallTimestamp[addr] + RESET_PERIOD) {
            return (false, lastCallTimestamp[addr] + RESET_PERIOD - block.timestamp);
        }
        
        return (true, 0);
    }

    /**
     * @dev Creates multiple invite NFTs for a verified wallet.
     * @param creator The address that will receive the invite NFTs
     * @param newInviteCodes Array of invite codes to be created
     * @notice Each wallet can only create invites once
     */
    function createInviteNFTs(address creator, string[] memory newInviteCodes) external onlyOwner {
        require(!hasCreatedInvites[creator], "Already created invites");
        require(verifiedWallets[creator], "Wallet not verified");
        require(newInviteCodes.length == INVITES_PER_USER, "Invalid number of invite codes");

        for (uint256 i = 0; i < newInviteCodes.length; i++) {
            string memory inviteCode = newInviteCodes[i];
            require(bytes(inviteCode).length >= MIN_INVITE_LENGTH, "Invite code too short");
            require(bytes(inviteCode).length <= MAX_INVITE_LENGTH, "Invite code too long");
            require(_isValidInviteFormat(inviteCode), "Invalid invite code format");
            require(!existingInviteCodes[inviteCode], "Invite code already exists");

            tokenIdCounter++;
            uint256 tokenId = tokenIdCounter;

            _safeMint(creator, tokenId);
            inviteCodes[tokenId] = inviteCode;
            existingInviteCodes[inviteCode] = true;
        }

        hasCreatedInvites[creator] = true;
        emit InvitesCreated(creator, newInviteCodes);
    }

    /**
    * @dev Activates an invite using its alpha-numeric code and links it with an email.
    * Marks the invite code as activated, preventing further use. Ownership of the InviteNFT
    * can later be transferred when the Ethereum address is provided.
    * @param inviteCode The alpha-numeric code associated with the invite NFT.
    * @param email The email associated with this invite code.
    */
    function activateInvite(string memory inviteCode, string memory email) external onlyOwner {
        require(bytes(inviteCode).length > 0, "Invite code cannot be empty.");
        require(bytes(email).length > 0, "Email cannot be empty.");
        require(!activatedInviteCodes[inviteCode], "Invite code is already activated.");
        
        bytes32 hashedEmail = keccak256(abi.encodePacked(email));
        require(bytes(hashedEmailToInviteCode[hashedEmail]).length == 0, "Email already linked to an invite.");

        uint256 tokenId = _getTokenIdByInviteCode(inviteCode);
        require(tokenId != 0, "Invalid invite code.");

        activatedInviteCodes[inviteCode] = true;
        hashedEmailToInviteCode[hashedEmail] = inviteCode;

        emit InviteActivated(inviteCode, hashedEmail, msg.sender);
    }

    /**
     * @dev Верифицирует кошелек пользователя через подпись
     * @param wallet Адрес кошелька для верификации
     * @param signature Подпись сообщения
     */
    function verifyWallet(address wallet, bytes memory signature) external onlyOwner {
        require(!verifiedWallets[wallet], "Wallet already verified");
        require(!usedSignatures[signature], "Signature already used");

        bytes32 messageHash = keccak256(abi.encodePacked(VERIFICATION_MESSAGE, wallet));
        address signer = recoverSigner(messageHash, signature);
        require(signer == wallet, "Invalid signature");

        verifiedWallets[wallet] = true;
        usedSignatures[signature] = true;

        emit WalletVerified(wallet);
    }

    /**
     * @dev Восстанавливает адрес подписавшего из подписи
     * @param messageHash Хэш подписанного сообщения
     * @param signature Подпись
     */
    function recoverSigner(bytes32 messageHash, bytes memory signature) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        if (v < 27) {
            v += 27;
        }

        require(v == 27 || v == 28, "Invalid signature 'v' value");

        return ecrecover(messageHash, v, r, s);
    }

    /**
     * @dev Connects a verified wallet with an activated invite code.
     * @param email The email associated with the invite code
     * @param wallet The wallet address to be connected
     * @notice The wallet must be verified before connecting
     */
    function connectWallet(string memory email, address wallet) external onlyOwner {
        require(wallet != address(0), "Invalid wallet address");
        require(verifiedWallets[wallet], "Wallet not verified");
        
        bytes32 hashedEmail = keccak256(abi.encodePacked(email));
        string memory inviteCode = hashedEmailToInviteCode[hashedEmail];
        require(bytes(inviteCode).length > 0, "Email not found");
        require(inviteCodeToWallet[inviteCode] == address(0), "Invite code already connected to wallet");

        // Связываем инвайт-код с кошельком
        inviteCodeToWallet[inviteCode] = wallet;
        
        // Связываем email с кошельком
        emailToWallet[email] = wallet;
        walletToEmail[wallet] = email;

        // Передаем NFT новому владельцу
        uint256 tokenId = getTokenIdByInviteCode(inviteCode);
        address currentOwner = ownerOf(tokenId);
        _transfer(currentOwner, wallet, tokenId);

        emit WalletConnected(hashedEmail, wallet, inviteCode);
    }

    /**
     * @dev Validates wallet address format and basic requirements
     * @param wallet Address to validate
     * @return bool Returns true if wallet meets basic requirements
     */
    function _isValidWallet(address wallet) internal view returns (bool) {
        return wallet != address(0) && 
               wallet != address(this) &&
               uint160(wallet) > 0;
    }

    /**
     * @dev Internal function to retrieve the token ID by its associated invite code.
     * @param inviteCode The alpha-numeric code associated with the invite NFT.
     * @return tokenId The token ID linked to the invite code.
     */
    function _getTokenIdByInviteCode(string memory inviteCode) internal view returns (uint256) {
        for (uint256 i = 1; i <= tokenIdCounter; i++) {
            if (keccak256(abi.encodePacked(inviteCodes[i])) == keccak256(abi.encodePacked(inviteCode))) {
                return i;
            }
        }
        return 0;
    }

    /**
     * @dev Checks if an invite code has been activated.
     * @param inviteCode The alpha-numeric code associated with the invite NFT.
     * @return bool Returns true if the invite code is already activated, false otherwise.
     */
    function isInviteActivated(string memory inviteCode) external view returns (bool) {
        return activatedInviteCodes[inviteCode];
    }

    /**
     * @dev Logs which address activated a specific invite code.
     * @param inviteCode The alpha-numeric code associated with the invite NFT.
     * @return address Returns the address that activated the invite code.
     */
    function getActivator(string memory inviteCode) external view returns (address) {
        return inviteActivator[inviteCode];
    }

    /**
     * @dev Centralized issuance of 8 InviteNFTs for a newly registered user with LegalNFT.
     * @param newOwner The address of the user receiving the 8 InviteNFTs.
     * @param inviteCodesArray An array of 8 unique invite codes for each InviteNFT.
     */
    function issueBatchInvites(address newOwner, string[8] memory inviteCodesArray) external onlyOwner {
        require(inviteCodesArray.length == 8, "Must provide exactly 8 invite codes.");

        for (uint256 i = 0; i < 8; i++) {
            require(!activatedInviteCodes[inviteCodesArray[i]], "One of the invite codes is already used.");
            
            tokenIdCounter++;
            uint256 tokenId = tokenIdCounter;

            _safeMint(newOwner, tokenId);
            inviteCodes[tokenId] = inviteCodesArray[i];
            activatedInviteCodes[inviteCodesArray[i]] = false;
            existingInviteCodes[inviteCodesArray[i]] = true;
        }
    }

    // Событи
    event InvitesCreated(address indexed creator, string[] inviteCodes);

    function onERC721Received(
        address,  // operator
        address,  // from
        uint256,  // tokenId
        bytes calldata  // data
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    // Переопределение supportsInterface для поддержки всех интерфейсов
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // Переопределение _burn для корректной работы с URI
    function _burn(uint256 tokenId) 
        internal 
        override(ERC721, ERC721URIStorage) 
    {
        super._burn(tokenId);
    }

    // Переопределение tokenURI для получения метаданных
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    // 1. Добавляем override для _beforeTokenTransfer
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal virtual override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }

    // Доавляем событие
    event WalletVerified(address indexed wallet);

    /**
     * @dev Gets wallet address linked to invite code
     * @param inviteCode The invite code to check
     * @return address The linked wallet address or zero address if not linked
     */
    function getWalletByInviteCode(string memory inviteCode) external view returns (address) {
        return inviteCodeToWallet[inviteCode];
    }

    /**
     * @dev Checks if invite code is linked to a wallet
     * @param inviteCode The invite code to check
     * @return bool True if invite code is linked to a wallet
     */
    function isInviteCodeLinked(string memory inviteCode) external view returns (bool) {
        return inviteCodeToWallet[inviteCode] != address(0);
    }

    /**
     * @dev Модификатор для ограничения частоты вызовов
     * @param delay Минимальная задержка между вызовами
     */
    modifier rateLimiter(uint256 delay) {
        require(block.timestamp >= lastCallTimestamp[msg.sender] + delay, 
            "Please wait before next call");
        
        // Сброс счетчика, если прошел период сброса
        if (block.timestamp >= lastCallTimestamp[msg.sender] + RESET_PERIOD) {
            callCounter[msg.sender] = 0;
        }
        
        // Проверка количества вызовов
        require(callCounter[msg.sender] < MAX_CALLS_PER_PERIOD, 
            "Too many requests in this period");
        
        // Обновляем счетчики
        callCounter[msg.sender]++;
        lastCallTimestamp[msg.sender] = block.timestamp;
        _;
    }

    // Функция для получения ETH
    receive() external payable {}

    // Добавьте эту функцию в контракт
    function isWalletVerified(address wallet) external view returns (bool) {
        return verifiedWallets[wallet];
    }

    // Изменяем функцию с internal на public
    function getTokenIdByInviteCode(string memory inviteCode) public view returns (uint256) {
        for (uint256 i = 1; i <= tokenIdCounter; i++) {
            if (keccak256(abi.encodePacked(inviteCodes[i])) == keccak256(abi.encodePacked(inviteCode))) {
                return i;
            }
        }
        return 0;
    }
}