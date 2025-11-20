// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../interfaces/ITOnNeInterface.sol"; 

/**
 * @title TransportNetworkOntology
 * @author Michele Castoldi
 * @notice Central registry for all elements (Stops, Services, Organizations) and the root of Merkle Proof generation.
 * @dev This contract acts as the Single Source of Truth (SSOT) and the root node (Registry/Control) shown in the architecture diagram.
 */
contract TransportNetworkOntology {
    
    mapping(string => address) public stops; 
    mapping(string => address) public services; 
    mapping(address => bool) public registeredOrganisations;
    
    address public admin; 

    /**
     * @notice Initializes the contract and sets the deployer (STUB) as the initial admin.
     */
    constructor() {
        admin = msg.sender;
    }

    /**
     * @notice Restricts function execution to the designated contract admin address.
     */
    modifier onlyAdmin() {
        require(msg.sender == admin, "TOnNe: Not admin");
        _;
    }

    /**
     * @notice Transfers administrative privileges to a new address.
     * @dev Callable only by the current admin.
     * @param newAdmin The address to receive the admin role.
     */
    function transferAdmin(address newAdmin) external onlyAdmin {
        admin = newAdmin;
    }

    /**
     * @notice Registers a new organization's address as a valid validator in the network.
     * @dev Callable only by the contract admin.
     * @param _orgAddress The address of the Transport Service Provider or Validator organization.
     */
    function addOrganisation(address _orgAddress) external onlyAdmin {
        registeredOrganisations[_orgAddress] = true;
    }

    /**
     * @notice Registers a new Service contract address with its unique ID.
     * @dev Callable only by the contract admin.
     * @param _id The unique identifier for the service route.
     * @param _serviceContract The address of the Service contract instance.
     */
    function addService(string memory _id, address _serviceContract) external onlyAdmin {
        services[_id] = _serviceContract;
    }
    
    /**
     * @notice Calculates the combined Merkle Root for a list of registered Services.
     * @dev This key function is used by off-chain middleware to verify the Proof-of-Validity against the Merkle Root.
     * @param _serviceIds An array of Service IDs to include in the root calculation.
     * @return The combined 32-byte Merkle Root hash digest.
     */
    function getServiceHashDigest(string[] memory _serviceIds) 
        external 
        view 
        returns (bytes32) 
    {
        require(_serviceIds.length > 0, "TOnNe: ID list cannot be empty");
        bytes32 combinedHash = 0;
        
        for (uint i = 0; i < _serviceIds.length; i++) {
            address serviceAddr = services[_serviceIds[i]];
            bytes32 serviceHash = ITOnNeInterface(serviceAddr).getHashDigest();
            
            combinedHash = keccak256(abi.encodePacked(combinedHash, serviceHash));
        }
        return combinedHash;
    }
}