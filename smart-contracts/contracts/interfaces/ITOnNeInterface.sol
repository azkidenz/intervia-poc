// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title ITOnNeInterface
 * @author Michele Castoldi
 * @notice Core data interface for Transport Network Ontology elements.
 * @dev Implemented by all data elements (e.g., Stops, Services) participating in the Merkle Proof validation structure.
 */
interface ITOnNeInterface {

    /**
     * @notice Gets the unique cryptographic hash (digest) of the ontology element.
     * @dev Hash used as the Merkle tree leaf node for proofs.
     * @return The 32-byte cryptographic hash.
     */
    function getHashDigest() external view returns (bytes32);

    /**
     * @notice Retrieves the full serialized data and details of the ontology element.
     * @dev Raw bytes returned; requires off-chain decoding for interpretation.
     */
    function getDetails() external view returns (bytes memory);
}