// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/ITOnNeInterface.sol"; 

/**
 * @title Service
 * @author Michele Castoldi
 * @notice Represents a specific transport line  owned by a Transport Service Provider (TSP).
 * @dev This contract implements ITOnNeInterface and provides functions for route management (planned stops) and hash generation for Merkle Proofs.
 */
contract Service is ITOnNeInterface {
    string public id; 
    address public tspOwner;
    
    address[] public plannedStops; 

    /**
     * @notice Initializes the Service with its unique ID and the TSP owner's address.
     * @param _id The unique identifier for the service route.
     * @param _tspOwner The address of the Transport Service Provider that owns this service.
     */
    constructor(string memory _id, address _tspOwner) {
        id = _id;
        tspOwner = _tspOwner;
    }
    
    /**
     * @notice Restricts function execution to the designated TSP owner address.
     */
    modifier onlyTspOwner() {
        require(msg.sender == tspOwner, "Service: Not TSP owner");
        _;
    }

    /**
     * @notice Adds a new Stop contract address to the list of planned stops for this route.
     * @dev Can only be called by the TSP owner.
     * @param _stopContract The address of the Stop contract to be added to the route.
     */
    function addPlannedStop(address _stopContract) external onlyTspOwner {
        plannedStops.push(_stopContract);
    }

    /**
     * @notice Calculates the unique hash digest for this Service contract instance.
     * @dev The digest is calculated by hashing the Service ID and the list of planned stop addresses. Used as the Merkle leaf node.
     * @return The 32-byte hash digest.
     */
    function getHashDigest() external view override returns (bytes32) {
        return keccak256(abi.encodePacked(id, plannedStops));
    }
    
    /**
     * @notice Returns the core identity details of the Service.
     * @dev Returns serialized data containing the Service ID and the TSP Owner address.
     * @return A byte array containing the packed Service details.
     */
    function getDetails() external view override returns (bytes memory) {
        return abi.encodePacked("Service ID:", id, " Owner:", tspOwner);
    }
}