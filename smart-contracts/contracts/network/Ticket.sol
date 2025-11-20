// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../network/TransportNetworkOntology.sol";

/**
 * @title Ticket
 * @author Michele Castoldi
 * @notice Represents a transport ticket asset defining a specific route, time constraints, and state machine.
 * @dev The contract handles the ticket's lifecycle: Issued, Activated, and Expired. It relies on TransportNetworkOntology for validation checks.
 */
contract Ticket { 
    bytes32 public id; 
    address public customerAddress;
    string public serviceId; 
    address public issuer;
    
    string public originStopId;      
    string public destinationStopId;
    string public ticketType;

    enum TicketState { Issued, Activated, Expired }
    TicketState public currentState; 

    uint256 public activationTimestamp;
    string public entryStationId;

    TransportNetworkOntology public activeTOnNe;

    /**
     * @notice Initializes a new Ticket asset.
     * @dev Sets the ticket's core data, registers the issuer, and links to the active TOnNe contract for validation.
     * @param _id Unique cryptographic ID for the ticket.
     * @param _customerAddress The wallet address of the customer.
     * @param _serviceId The service identifier.
     * @param _originStopId The ticket's origin stop.
     * @param _destinationStopId The ticket's destination stop.
     * @param _ticketType The product type.
     * @param _issuer The TSP address issuing the ticket.
     * @param _tonneAddress Address of the active TransportNetworkOntology contract.
     */
    constructor(
        bytes32 _id,
        address _customerAddress,
        string memory _serviceId,
        string memory _originStopId,
        string memory _destinationStopId,
        string memory _ticketType,
        address _issuer,
        address _tonneAddress
    ) {
        id = _id;
        customerAddress = _customerAddress;
        serviceId = _serviceId;
        originStopId = _originStopId;
        destinationStopId = _destinationStopId;
        ticketType = _ticketType;
        issuer = _issuer;
        currentState = TicketState.Issued;
        activeTOnNe = TransportNetworkOntology(_tonneAddress);
    }

    /**
     * @notice Restricts function execution to addresses registered as validators in the TOnNe contract.
     */
    modifier onlyRegisteredValidator() {
        require(activeTOnNe.registeredOrganisations(msg.sender), "Ticket: Not a registered validator");
        _;
    }

    /**
     * @notice Activates the ticket upon the initial activation.
     * @dev Updates the ticket state and records the activation timestamp and entry station. Callable only by a registered validator.
     * @param _entryStationId The ID of the station where the ticket is being activated.
     * @return True upon successful activation.
     */
    function activate(string memory _entryStationId) external onlyRegisteredValidator returns (bool) {
        require(currentState == TicketState.Issued, "Ticket: Already activated or expired");
        
        activationTimestamp = block.timestamp;
        entryStationId = _entryStationId;
        currentState = TicketState.Activated;
        return true;
    }
    
    /**
     * @notice Forces the ticket state to Expired, upon timeout or control check.
     * @dev Called by a validator when the ticket validity period has elapsed.
     * @return True upon successfully setting the state to Expired.
     */
    function forceExpire() external onlyRegisteredValidator returns (bool) {
        require(currentState == TicketState.Activated, "Ticket: Not active or already expired");
        currentState = TicketState.Expired;
        return true;
    }
}