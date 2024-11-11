// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Estonians888DIDRegistry
 * @dev This contract manages the registration and verification of Decentralized Identifiers (DIDs) for users.
 * It stores associations between DIDs and user attributes such as KYC status, social proof, and LegalNFT.
 */
contract Estonians888DIDRegistry is Ownable {
    
    constructor() Ownable(msg.sender) {}

    struct DIDAttributes {
        bool kycVerified;
        mapping(bytes32 => string) socialProfiles; // Mapping from platform code to social alias (username)
        bool socialVerified;
        uint256 legalNFTTokenId;
        uint256 inviteTokenId;
    }

    // Define constants for social platform codes
    bytes32 public constant PLATFORM_X = "x";           // X (Twitter)
    bytes32 public constant PLATFORM_INSTAGRAM = "ig";   // Instagram
    bytes32 public constant PLATFORM_TIKTOK = "tt";      // TikTok
    bytes32 public constant PLATFORM_TELEGRAM = "tg";    // Telegram
    bytes32 public constant PLATFORM_PINTEREST = "pt";   // Pinterest
    bytes32 public constant PLATFORM_YOUTUBE = "yt";     // Youtube
    bytes32 public constant PLATFORM_LINKEDIN = "li";    // LinkedIn
    bytes32 public constant PLATFORM_FACEBOOK = "fb";    // Facebook

    mapping(address => string) public userDIDs;                     // Mapping from user address to DID string
    mapping(string => DIDAttributes) private didAttributesStorage;  // Mapping from DID to associated attributes

    // Event emitted when a new DID is registered
    event DIDRegistered(address indexed user, string did, uint256 inviteTokenId);

    // Event emitted when KYC status is updated for a DID
    event KYCStatusUpdated(string indexed did, bool status);

    // Event emitted when social proof is linked to a DID
    event SocialProofLinked(string indexed did, bytes32 platform, string socialAlias, bool verified);

    // Event emitted when a LegalNFT is linked to a DID
    event LegalNFTLinked(string indexed did, uint256 legalNFTTokenId);

    /**
     * @dev Registers a new DID for a user, linking it to an InviteNFT.
     * Only callable by the contract owner or authorized entity.
     * @param user The address of the user registering the DID.
     * @param did The DID string to be registered.
     * @param inviteTokenId The token ID of the activated InviteNFT associated with this DID.
     */
    function registerDID(address user, string memory did, uint256 inviteTokenId) external onlyOwner {
        require(bytes(userDIDs[user]).length == 0, "DID already registered for this user.");
        
        // Link the DID with the user and initial invite information
        userDIDs[user] = did;
        DIDAttributes storage attributes = didAttributesStorage[did];
        attributes.inviteTokenId = inviteTokenId;

        emit DIDRegistered(user, did, inviteTokenId);
    }

    /**
     * @dev Updates the KYC status for a specified DID.
     * @param did The DID string to update KYC status for.
     * @param status The new KYC status (true if verified, false if not).
     */
    function updateKYCStatus(string memory did, bool status) external onlyOwner {
        require(bytes(did).length > 0, "DID is not registered.");

        didAttributesStorage[did].kycVerified = status;
        emit KYCStatusUpdated(did, status);
    }

    /**
     * @dev Links a social profile alias to a specified DID with a platform code.
     * @param did The DID string to link social proof for.
     * @param platform The code of the social platform (e.g., PLATFORM_X for X).
     * @param socialAlias The alias or username on the social platform.
     * @param verified The verification status on the platform (true if verified).
     */
    function linkSocialProof(string memory did, bytes32 platform, string memory socialAlias, bool verified) external onlyOwner {
        require(bytes(did).length > 0, "DID is not registered.");
        require(
            platform == PLATFORM_X || platform == PLATFORM_INSTAGRAM ||
            platform == PLATFORM_TIKTOK || platform == PLATFORM_TELEGRAM ||
            platform == PLATFORM_PINTEREST || platform == PLATFORM_YOUTUBE ||
            platform == PLATFORM_LINKEDIN || platform == PLATFORM_FACEBOOK,
            "Invalid social platform code."
        );

        DIDAttributes storage attributes = didAttributesStorage[did];
        attributes.socialProfiles[platform] = socialAlias;
        attributes.socialVerified = verified;

        emit SocialProofLinked(did, platform, socialAlias, verified);
    }

    /**
     * @dev Links a LegalNFT to a specified DID.
     * @param did The DID string to link LegalNFT for.
     * @param legalNFTTokenId The token ID of the LegalNFT.
     */
    function linkLegalNFT(string memory did, uint256 legalNFTTokenId) external onlyOwner {
        require(bytes(did).length > 0, "DID is not registered.");

        didAttributesStorage[did].legalNFTTokenId = legalNFTTokenId;
        emit LegalNFTLinked(did, legalNFTTokenId);
    }

    /**
     * @dev Retrieves the KYC status and the presence of a LegalNFT associated with a DID.
     * @param did The DID string to retrieve attributes for.
     * @return bool KYC status (true if verified) and the LegalNFT token ID.
     */
    function getDIDAttributes(string memory did) external view returns (bool, uint256) {
        require(bytes(did).length > 0, "DID is not registered.");

        DIDAttributes storage attributes = didAttributesStorage[did];
        return (attributes.kycVerified, attributes.legalNFTTokenId);
    }

    /**
     * @dev Retrieves the social alias for a DID on a specified platform.
     * @param did The DID string to retrieve social alias for.
     * @param platform The code of the social platform.
     * @return string The alias (username) on the specified social platform.
     */
    function getSocialAlias(string memory did, bytes32 platform) external view returns (string memory) {
        require(bytes(did).length > 0, "DID is not registered.");
        require(
            platform == PLATFORM_X || platform == PLATFORM_INSTAGRAM ||
            platform == PLATFORM_TIKTOK || platform == PLATFORM_TELEGRAM ||
            platform == PLATFORM_PINTEREST || platform == PLATFORM_YOUTUBE ||
            platform == PLATFORM_LINKEDIN || platform == PLATFORM_FACEBOOK,
            "Invalid social platform code."
        );

        return didAttributesStorage[did].socialProfiles[platform];
    }

    /**
     * @dev Checks if a DID has passed KYC verification.
     * @param did The DID string to check KYC status for.
     * @return bool Returns true if KYC is verified for the DID, false otherwise.
     */
    function isKYCVerified(string memory did) external view returns (bool) {
        require(bytes(did).length > 0, "DID is not registered.");
        return didAttributesStorage[did].kycVerified;
    }
}