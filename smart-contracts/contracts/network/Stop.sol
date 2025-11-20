// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/ITOnNeInterface.sol"; 

/**
 * @title Stop
 * @author Michele Castoldi
 * @notice Represents a single geographical location or station within the transport network.
 * @dev Implements ITOnNeInterface to allow the stop's data to be included in Merkle Proofs. Note: Only the ID is used for Proof of Concept (PoC) simplicity.
 */
contract Stop is ITOnNeInterface {
    string public id; 

    /**
     * @notice Initializes the Stop contract with its unique identifier.
     * @param _id The unique identifier for the stop (e.g., station code).
     */
    constructor(string memory _id) {
        id = _id;
    }

    /**
     * @notice Calculates the unique hash digest for this Stop entity.
     * @dev The hash is calculated solely from the stop's unique ID. Used as the Merkle leaf node.
     * @return The 32-byte hash digest.
     */
    function getHashDigest() external view override returns (bytes32) {
        return keccak256(abi.encodePacked(id));
    }
    
    /**
     * @notice Returns the core identification details of the Stop.
     * @dev Returns serialized data containing the Stop ID. In a full implementation, coordinates would also be included.
     * @return A byte array containing the packed Stop ID details.
     */
    function getDetails() external view override returns (bytes memory) {
        return abi.encodePacked("Stop:", id);
    }
}