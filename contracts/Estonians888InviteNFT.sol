// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/**
 * @title Estonians888InviteNFT
 * @dev A smart contract for managing an invite-only NFT system with the following features:
 * 
 * Core Functionality:
 * - Minting of invite NFTs with unique alpha-numeric codes
 * - Verification system for wallets through cryptographic signatures
 * - Email-to-wallet linking mechanism
 * - Batch creation of new invites (8 per verified wallet)
 * 
 * Security Features:
 * - Rate limiting to prevent abuse
 * - Signature verification for wallet authentication
 * - One-time use invite codes
 * - Protection against duplicate emails and wallets
 * 
 * Key Components:
 * - ERC721 Enumerable and URI Storage support
 * - Owner-controlled administrative functions
 * - Event logging for all major operations
 * - Anti-spam mechanisms
 * 
 * Integration:
 * - Interfaces with Estonians888NFT main contract
 * - Supports standard ERC721 receiver interface
 * 
 * Access Control:
 * - Owner-restricted administrative functions
 * - Verified wallet requirements for new invites creation
 * - Single-use permissions for invite generation
 * 
 * @notice This contract serves as the gateway for new members joining the Estonians888 ecosystem
 * through a controlled invitation system
 */
contract Estonians888InviteNFT is ERC721Enumerable, Ownable, IERC721Receiver, ERC721URIStorage {
    
    // Mapping in the contract state to store the alpha-numeric invite code for each tokenId
    mapping(uint256 => string) public inviteCodes;

    // Mapping to store the address that activated the invite code
    mapping(string => address) public inviteActivator;

    // Links email to invite code
    mapping(string => string) private hashedEmailToInviteCode;
    
    // Tracks activation status of invite codes
    mapping(string => bool) public activatedInviteCodes;

    // Event emitted when invite code is activated
    event InviteActivated(string inviteCode, string indexed hashedEmail, address indexed activator);

    // Counter for token IDs
    uint256 private tokenIdCounter;

    // Mapping to track if an address has used its right to mint his own invites
    mapping(address => bool) public hasCreatedInvites;

    // Number of invites that can be created
    uint256 private constant INVITES_PER_USER = 8;

    // Mapping in the contract state to store the existence of invite codes
    mapping(string => bool) public existingInviteCodes;

    // Mapping in the contract state to track verified wallets
    mapping(address => bool) public verifiedWallets;

    // Mapping in the contract state to link email to wallet address
    mapping(string => address) public emailToWallet;
    mapping(address => string) public walletToEmail;

    // Events for detailed logging
    event WalletConnectionStarted(bytes32 indexed hashedEmail, address indexed wallet);
    event InviteCodeFound(bytes32 indexed hashedEmail, string inviteCode);
    event NFTTransferInitiated(uint256 tokenId, address from, address to);
    event WalletConnected(string indexed hashedEmail, address indexed wallet, string inviteCode);

    // Adding a salt for hashing invite codes in the contract state
    bytes32 private immutable SALT;
    mapping(bytes32 => bool) private hashedInviteCodes;
    uint256 private constant INVITE_LENGTH = 13;

    // Adding a verification message to the contract state
    string private constant VERIFICATION_MESSAGE = "Verify wallet for Estonians888InviteNFT";
    mapping(bytes => bool) private usedSignatures;

    // Adding a mapping for the link between invite codes and wallets
    mapping(string => address) public inviteCodeToWallet;

    // Adding a mapping in the contract state to track the last call timestamp
    mapping(address => uint256) private lastCallTimestamp;
    mapping(address => uint256) private callCounter;
    uint256 private constant CALL_DELAY = 1 minutes;
    uint256 private constant MAX_CALLS_PER_PERIOD = 10;
    uint256 private constant RESET_PERIOD = 1 hours;

    // Prefix for Ethereum Signed Message
    string constant PREFIX = "\x19Ethereum Signed Message:\n32";

    /**
     * @dev Initializes the contract with the name and symbol for the InviteNFT.
     */
    constructor() ERC721("Estonians888InviteNFT", "E888INVITE") {
        SALT = keccak256(abi.encodePacked(block.timestamp, msg.sender));
    }

    /**
     * @dev Mints a new InviteNFT with a unique alpha-numeric invite code.
     * Only callable by the contract owner.
     * @param to The address to which the InviteNFT will be minted.
     * @param inviteCode The unique alpha-numeric code associated with this invite NFT.
     */
    function mintInvite(address to, string memory inviteCode, string memory mintTokenURI) external onlyOwner {
        // Validation of input data
        require(bytes(inviteCode).length == INVITE_LENGTH, "Invalid invite code length");
        require(_isValidInviteFormat(inviteCode), "Invalid invite code format");
        
        // Hashing with salt
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

    /**
     * @dev Validates the format of an invite code
     * @param code The invite code to validate
     * @return bool Returns true if the code contains only allowed characters
     */
    function _isValidInviteFormat(string memory code) private pure returns (bool) {
        bytes memory b = bytes(code);
        for(uint i; i < b.length; i++){
            bytes1 char = b[i];
            if(!(
                (char >= 0x30 && char <= 0x39) || // 0-9
                (char >= 0x41 && char <= 0x5A) || // A-Z
                (char >= 0x61 && char <= 0x7A) || // a-z
                char == 0x2D                      // -
            )) return false;
        }
        return true;
    }

    /**
     * @dev Validates the invite code for validity.
     * @param inviteCode The invite code to validate.
     * @return isValid true if the invite code exists and is not activated.
     */
    function validateInviteCode(string memory inviteCode) 
        external 
        rateLimiter(CALL_DELAY) 
        returns (bool isValid) 
    {
        return existingInviteCodes[inviteCode] && !activatedInviteCodes[inviteCode];
    }

    /**
     * @dev Gets the call limit information for an address
     * @param addr The address to check
     * @return remainingCalls The remaining number of calls
     * @return nextResetTime The time of the next reset
     * @return canCallAfter The time when the next call can be made
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
        
        // Calculating the remaining calls
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
     * @dev Checks the possibility of calling the method for an address
     * @param addr The address to check
     * @return canCall The possibility of calling
     * @return waitTime The waiting time (if canCall = false)
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
     * @dev Creates multiple invite NFTs with associated codes and metadata
     * @param to Address to receive the NFTs
     * @param codes Array of invite codes to be associated with the NFTs
     * @param metadataURIs Array of metadata URIs for the NFTs
     * @notice Only verified wallets can create invites
     * @notice Non-owner wallets can only create INVITES_PER_USER invites once
     * @notice Owner can create unlimited invites multiple times
     */
    function createInviteNFTs(
        address to,
        string[] memory codes,
        string[] memory metadataURIs
    ) external {
        require(
            msg.sender == owner() || verifiedWallets[msg.sender],
            "Must be owner or verified wallet"
        );
        
        // Adding a check: if sender is not owner, check limits
        if (msg.sender != owner()) {
            require(!hasCreatedInvites[msg.sender], "Already created invites");
            require(codes.length == INVITES_PER_USER, "Invalid number of invites");
            hasCreatedInvites[msg.sender] = true;
        }

        for (uint256 i = 0; i < codes.length; i++) {
            require(!existingInviteCodes[codes[i]], "Invite code already exists");
            existingInviteCodes[codes[i]] = true;
            
            tokenIdCounter++;
            _safeMint(to, tokenIdCounter);
            _setTokenURI(tokenIdCounter, metadataURIs[i]);
            inviteCodes[tokenIdCounter] = codes[i];
        }

        emit BatchInvitesCreated(msg.sender, codes);
    }

    /**
    * @dev Activates an invite using its alpha-numeric code and links it with an hashedEmail.
    * Marks the invite code as activated, preventing further use. Ownership of the InviteNFT
    * can later be transferred when the Ethereum address is provided.
    * @param inviteCode The alpha-numeric code associated with the invite NFT.
    * @param hashedEmail The hashedEmail associated with this invite code.
    */
    function activateInvite(string memory inviteCode, string memory hashedEmail) external onlyOwner {
        require(bytes(inviteCode).length > 0, "Invite code cannot be empty.");
        require(bytes(hashedEmail).length > 0, "Hashed email cannot be empty.");
        require(!activatedInviteCodes[inviteCode], "Invite code is already activated.");
        
        require(bytes(hashedEmailToInviteCode[hashedEmail]).length == 0, "Email already linked to an invite.");

        uint256 tokenId = _getTokenIdByInviteCode(inviteCode);
        require(tokenId != 0, "Invalid invite code.");

        activatedInviteCodes[inviteCode] = true;
        hashedEmailToInviteCode[hashedEmail] = inviteCode;

        emit InviteActivated(inviteCode, hashedEmail, msg.sender);
    }

    /**
     * @dev Verifies a wallet through a signature
     */
    function verifyWallet(address wallet, bytes memory signature) external {
        require(!verifiedWallets[wallet], "Wallet already verified");
        require(!usedSignatures[signature], "Signature already used");

        // Forming a message
        bytes32 messageHash = keccak256(abi.encodePacked(VERIFICATION_MESSAGE, wallet));
        
        // Adding the Ethereum Signed Message prefix
        bytes32 ethSignedMessageHash = keccak256(abi.encodePacked(PREFIX, messageHash));

        // Recovering the address of the signer
        address signer = recoverSigner(ethSignedMessageHash, signature);
        require(signer == wallet, "Invalid signature");

        verifiedWallets[wallet] = true;
        usedSignatures[signature] = true;

        emit WalletVerified(wallet);
    }

    /**
     * @dev Recovers the address of the signer from the signature
     */
    function recoverSigner(bytes32 ethSignedMessageHash, bytes memory signature) internal pure returns (address) {
        require(signature.length == 65, "Invalid signature length");

        bytes32 r;
        bytes32 s;
        uint8 v;

        assembly {
            r := mload(add(signature, 32))
            s := mload(add(signature, 64))
            v := byte(0, mload(add(signature, 96)))
        }

        // Ethereum uses 27/28 for v
        if (v < 27) {
            v += 27;
        }

        require(v == 27 || v == 28, "Invalid signature 'v' value");

        // Recovering the address using the already prepared hash
        return ecrecover(ethSignedMessageHash, v, r, s);
    }

    /**
     * @dev Connects a verified wallet with an activated invite code.
     * @param hashedEmail The hashedEmail associated with the invite code
     * @param wallet The wallet address to be connected
     * @notice The wallet must be verified before connecting
     */
    function connectWallet(string memory hashedEmail, address wallet) external onlyOwner {
        require(bytes(hashedEmail).length > 0, "Hashed email cannot be empty.");
        // Validate if email is actually hashed
        require(wallet != address(0), "Invalid wallet address");
        require(verifiedWallets[wallet], "Wallet not verified");
        
        string memory inviteCode = hashedEmailToInviteCode[hashedEmail];

        require(bytes(inviteCode).length > 0, "Email not found");
        require(inviteCodeToWallet[inviteCode] == address(0), "Invite code already connected to wallet");

        // Connecting the invite code to the wallet
        inviteCodeToWallet[inviteCode] = wallet;
        
        // Linking the email to the wallet
        emailToWallet[hashedEmail] = wallet;
        walletToEmail[wallet] = hashedEmail;

        // Transferring the NFT to the new owner
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
     * @dev Issues a batch of 8 invite NFTs to a verified wallet
     * @param inviteCodesArray Array of 8 unique invite codes
     * Requirements:
     * - Caller must be a verified wallet
     * - Caller must not have created invites before
     * - All invite codes must be unique and not used
     */
    function issueBatchInvites(string[8] memory inviteCodesArray) external {
        require(verifiedWallets[msg.sender], "Wallet not verified");
        require(!hasCreatedInvites[msg.sender], "Already created invites");
        
        string[] memory convertedArray = new string[](8);
        for(uint i = 0; i < 8; i++) {
            convertedArray[i] = inviteCodesArray[i];
        }
        emit BatchInvitesCreated(msg.sender, convertedArray);
    }

    // Event is emitted when invites are created
    event InvitesCreated(address indexed creator, string[] inviteCodes);

    function onERC721Received(
        address,  // operator
        address,  // from
        uint256,  // tokenId
        bytes calldata  // data
    ) external pure override returns (bytes4) {
        return this.onERC721Received.selector;
    }

    // Overriding supportsInterface to support all interfaces
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721Enumerable, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // Overriding _burn to work correctly with URI
    function _burn(uint256 tokenId) 
        internal 
        override(ERC721, ERC721URIStorage) 
    {
        super._burn(tokenId);
    }

    // Overriding tokenURI to get metadata
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    // Adding override for _beforeTokenTransfer
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 firstTokenId,
        uint256 batchSize
    ) internal virtual override(ERC721, ERC721Enumerable) {
        super._beforeTokenTransfer(from, to, firstTokenId, batchSize);
    }

    // Adding an event
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
     * @dev Modifier to limit the frequency of calls
     * @param delay The minimum delay between calls
     */
    modifier rateLimiter(uint256 delay) {
        require(block.timestamp >= lastCallTimestamp[msg.sender] + delay, 
            "Please wait before next call");
        
        // Resetting the counter if the reset period has passed
        if (block.timestamp >= lastCallTimestamp[msg.sender] + RESET_PERIOD) {
            callCounter[msg.sender] = 0;
        }
        
        // Checking the number of calls
        require(callCounter[msg.sender] < MAX_CALLS_PER_PERIOD, 
            "Too many requests in this period");
        
        // Updating the counters
        callCounter[msg.sender]++;
        lastCallTimestamp[msg.sender] = block.timestamp;
        _;
    }

    // Function to receive ETH
    receive() external payable {}

    // Adding this function to the contract
    function isWalletVerified(address wallet) public view returns (bool) {
        require(wallet != address(0), "Invalid wallet address");
        // If this is the owner's address - automatically consider it verified
        if (wallet == owner()) {
            return true;
        }
        // Otherwise, check by mapping
        return verifiedWallets[wallet];
    }

    // Changing the function from internal to public
    function getTokenIdByInviteCode(string memory inviteCode) public view returns (uint256) {
        for (uint256 i = 1; i <= tokenIdCounter; i++) {
            if (keccak256(abi.encodePacked(inviteCodes[i])) == keccak256(abi.encodePacked(inviteCode))) {
                return i;
            }
        }
        return 0;
    }

    // Adding this event declaration together with other events
    event BatchInvitesCreated(address indexed creator, string[] inviteCodes);
}