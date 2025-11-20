// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Strings.sol"; 

/**
 * @title Organisation
 * @author Michele Castoldi
 * @notice Abstract base contract for managing a Transport Service Provider (TSP).
 * @dev Provides common state variables and the `onlyAdmin` mechanism required for TSP management.
 */
abstract contract Organisation {
    string public id; 
    address public admin; 

    mapping(string => address) public services; 

    /**
     * @notice Initializes the Organization by setting its unique ID and the admin address.
     * @param _id The unique identifier string for this organization.
     * @param _admin The address designated as the administrator.
     */
    constructor(string memory _id, address _admin) {
        id = _id;
        admin = _admin;
    }

    /**
     * @notice Restricts function execution to the designated admin address.
     */
    modifier onlyAdmin() {
        require(msg.sender == admin, "Org: Not admin");
        _;
    }
}