// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./Organisation.sol"; 

/**
 * @title TransportServiceProvider
 * @author Michele Castoldi
 * @notice Concrete implementation of the Organisation contract, representing a single transport provider.
 * @dev Inherits administrative functions and state from Organisation. Its primary role is to register and manage its owned service routes.
 */
contract TransportServiceProvider is Organisation {

    /**
     * @notice Initializes the TSP contract by calling the Organisation base constructor.
     * @param _id The unique identifier for the TSP organization.
     * @param _admin The initial administrator address for the TSP.
     */
    constructor(string memory _id, address _admin) Organisation(_id, _admin) {}

    /**
     * @notice Registers a new Service contract under the ownership of this TSP.
     * @dev Callable only by the organization's admin. Reverts if the service ID is already registered.
     * @param _serviceId The unique identifier for the new service route.
     * @param _serviceContract The address of the Service contract instance.
     */
    function addService(string memory _serviceId, address _serviceContract) external onlyAdmin {
        require(services[_serviceId] == address(0), "TSP: Service already exists");
        services[_serviceId] = _serviceContract;
    }
}