// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

/**
 * @title DynamicBadgeNFTContract
 * @dev This contract implements dynamic NFT badges for donor profiles in various categories.
 * Donors receive different levels of badges (Silver, Gold, Platinum) based on their accumulated donations.
 */
contract DynamicBadgeNFT {
    
    // Constants for badge levels
    uint256 public constant SILVER_THRESHOLD = 1; // Represents 100 EUR
    uint256 public constant GOLD_THRESHOLD = 5;    // Represents 500 EUR
    uint256 public constant PLATINUM_THRESHOLD = 10; // Represents 1000 EUR

    // Mapping to store each donor's accumulated donation index by category
    mapping(address => mapping(string => uint256)) public donationsIndex;

    // Mapping to store the current badge level of each donor by category
    mapping(address => mapping(string => string)) public badgeLevels;

    // IPFS CID for category data (metadata structure and available categories)
    string public ipfsCid;

    // Events for logging key actions
    event DonationReceived(address indexed donor, string category, uint256 amount, uint256 index);
    event BadgeUpdated(address indexed donor, string category, string newBadgeLevel);
    event IpfsCidUpdated(string newCid);

    /**
     * @dev Constructor to initialize the IPFS CID containing the category structure.
     * @param _ipfsCid The IPFS CID pointing to the category structure data in JSON format.
     */
    constructor(string memory _ipfsCid) {
        ipfsCid = _ipfsCid;
    }


    // Mapping to track donations before badge assignment
    mapping(address => mapping(string => uint256)) public accumulatedDonations;

    /**
     * @notice Allows donors to contribute to a specific category.
     * @param category The category name in which the donation is made.
     * @param amount The donation amount in wei (should be converted to index before storage).
     *
     * Instructions:
     * - Convert `amount` from wei to index by dividing by 100 EUR equivalent in wei.
     * - Update `donationsIndex` for the donor in the specified category.
     * - Check if the new donation index meets any threshold (Silver, Gold, Platinum).
     *   - If it meets a new threshold, update the `badgeLevels` mapping with the new badge level.
     *   - Emit `BadgeUpdated` event if a new badge level is assigned.
     * - Emit `DonationReceived` event with donor address, category, amount, and new index.
     */
    function donateToCategory(address donor, string calldata category, uint256 amount) external {
        // Update accumulated donations
        accumulatedDonations[donor][category] += amount;
        
        // Check if donor has reached Silver, Gold, or Platinum level in this category
        uint256 donationIndex = accumulatedDonations[donor][category] / 100; // Assuming each 100 EUR = 1 unit index
        
        if (donationIndex >= PLATINUM_THRESHOLD) {
            badgeLevels[donor][category] = "Platinum";
            accumulatedDonations[donor][category] = 0; // Reset after reaching Platinum
        } else if (donationIndex >= GOLD_THRESHOLD) {
            badgeLevels[donor][category] = "Gold";
            accumulatedDonations[donor][category] = 0; // Reset after reaching Gold
        } else if (donationIndex >= SILVER_THRESHOLD) {
            badgeLevels[donor][category] = "Silver";
            accumulatedDonations[donor][category] = 0; // Reset after reaching Silver
        }
        
        // Emit event for donation and potential badge update
        emit DonationReceived(donor, category, amount, donationIndex);
        if (keccak256(abi.encodePacked(badgeLevels[donor][category])) != keccak256(abi.encodePacked(""))) {
            emit BadgeUpdated(donor, category, badgeLevels[donor][category]);
        }
    }


    /**
     * @notice Updates the donor's badge level based on their current donation index.
     * @param donor The address of the donor.
     * @param category The category for which the badge is being updated.
     *
     * Instructions:
     * - Retrieve the current donation index for the donor in the specified category.
     * - Compare the index with thresholds (SILVER_THRESHOLD, GOLD_THRESHOLD, PLATINUM_THRESHOLD).
     * - If the index matches or exceeds a threshold, update `badgeLevels` to reflect the highest level met.
     * - Emit `BadgeUpdated` event with donor address, category, and new badge level.
     */
    function updateBadgeLevel(address donor, string calldata category) external {
        // Instructions only - see above for detailed steps
    }

    /**
     * @notice Fetches the donor's badge level for a specified category.
     * @param donor The address of the donor.
     * @param category The category for which the badge level is being retrieved.
     * @return The current badge level of the donor in the specified category.
     */
    function getBadgeLevel(address donor, string calldata category) external view returns (string memory) {
        return badgeLevels[donor][category];
    }

    /**
     * @notice Fetches the donation index of the donor in a specified category.
     * @param donor The address of the donor.
     * @param category The category for which the donation index is being retrieved.
     * @return The donation index of the donor in the specified category.
     */
    function getDonationIndex(address donor, string calldata category) external view returns (uint256) {
        return donationsIndex[donor][category];
    }

    /**
     * @notice Updates the IPFS CID for the category metadata.
     * @param newCid The new IPFS CID pointing to updated category data.
     *
     * Instructions:
     * - Update the `ipfsCid` variable with the new CID.
     * - Emit the `IpfsCidUpdated` event with the new CID.
     */
    function updateIpfsCid(string calldata newCid) external {
        // Instructions only - see above for detailed steps
    }
}