// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Estonians888InviteNFT
 * @dev This contract manages invitation-only access to the network by issuing invite NFTs.
 * Each InviteNFT includes a unique alpha-numeric code for activation and transfers ownership 
 * upon successful activation to the newly created user address.
 */
contract Estonians888InviteNFT is ERC721Enumerable, Ownable {
    
    // Mapping to track the activation status of invite codes
    mapping(string => bool) private activatedInviteCodes;

    // Mapping to store the alpha-numeric invite code for each tokenId
    mapping(uint256 => string) public inviteCodes;

    // Event emitted when an invite code is activated
    event InviteActivated(string inviteCode, address indexed newOwner);

    // Counter for token IDs
    uint256 private tokenIdCounter;

    /**
     * @dev Initializes the contract with the name and symbol for the InviteNFT.
     */
    constructor() ERC721("Estonians888InviteNFT", "E888INVITE") Ownable(msg.sender) {}

    /**
     * @dev Mints a new InviteNFT with a unique alpha-numeric invite code.
     * Only callable by the contract owner.
     * @param to The address to which the InviteNFT will be minted.
     * @param inviteCode The unique alpha-numeric code associated with this invite NFT.
     */
    function mintInvite(address to, string memory inviteCode) external onlyOwner {
        require(!activatedInviteCodes[inviteCode], "Invite code is already used or activated.");

        tokenIdCounter++;
        uint256 tokenId = tokenIdCounter;

        _safeMint(to, tokenId);
        inviteCodes[tokenId] = inviteCode;
        activatedInviteCodes[inviteCode] = false;
    }

    /**
     * @dev Activates an invite using its alpha-numeric code and transfers ownership of the InviteNFT
     * to a newly created wallet address. Marks the invite code as activated, preventing further use.
     * @param inviteCode The alpha-numeric code associated with the invite NFT.
     * @param newOwner The address of the newly created wallet.
     */
    function activateInvite(string memory inviteCode, address newOwner) external onlyOwner {
        require(!activatedInviteCodes[inviteCode], "Invite code is already activated.");

        uint256 tokenId = _getTokenIdByInviteCode(inviteCode);
        require(tokenId != 0, "Invalid invite code.");

        activatedInviteCodes[inviteCode] = true;

        _transfer(ownerOf(tokenId), newOwner, tokenId);
        emit InviteActivated(inviteCode, newOwner);
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
        }
    }
}