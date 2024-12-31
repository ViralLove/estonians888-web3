// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface IEstonians888DIDRegistry {
    function verifyDID(string calldata did) external view returns (bool);
    function getDIDOwner(string calldata did) external view returns (address);
    function isDIDRegistered(string calldata did) external view returns (bool);
} 