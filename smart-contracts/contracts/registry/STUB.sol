// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../network/TransportNetworkOntology.sol";
import "../network/TransportServiceProvider.sol";
import "../network/Ticket.sol";

import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title STUB (System Trivial Unified Bridge)
 * @author Michele Castoldi
 * @notice The main system entry point, functioning as the primary registry and ticket factory.
 * @dev This Singleton contract manages administrative tasks (registry updates) and handles the commercial logic of issuing new Ticket assets.
 */
contract STUB {
    using Strings for uint256;

    address public owner; 
    TransportNetworkOntology public activeTOnNe; 
    uint256 private ticketNonce = 1000;
    mapping(bytes32 => address) public issuedTickets;

    event NetworkOntologySet(address indexed tonneAddress); 
    event OrganisationRegistered(address indexed orgAddress);
    event TicketIssued(bytes32 indexed ticketId, address indexed customer, address indexed issuer);

    /**
     * @notice Initializes the STUB contract and links it to the active TOnNe contract address.
     * @dev Sets the deployer as the contract owner and establishes the TOnNe link for registry operations.
     * @param _initialTOnNeAddress Address of the already deployed TransportNetworkOntology contract.
     */
    constructor(address _initialTOnNeAddress) {
        owner = msg.sender;
        activeTOnNe = TransportNetworkOntology(_initialTOnNeAddress);
    }

    /**
     * @notice Restricts function execution to the contract owner.
     */
    modifier onlyOwner() {
        require(msg.sender == owner, "STUB: Not the owner");
        _;
    }

    /**
     * @notice Registers a new TSP or validator organization within the active TOnNe system.
     * @dev Called by the contract owner; forwards the request to the TOnNe contract.
     * @param _orgAddress The address of the organization or validator to register.
     */
    function registerOrganisation(address _orgAddress) external onlyOwner {
        require(address(activeTOnNe) != address(0), "STUB: TOnNe not set");
        activeTOnNe.addOrganisation(_orgAddress);
        emit OrganisationRegistered(_orgAddress);
    }

    /**
     * @notice Registers a new Service route contract within the active TOnNe system.
     * @dev Called by the contract owner; forwards the request to the TOnNe contract.
     * @param _id The unique identifier for the service route.
     * @param _serviceContract The address of the Service contract instance.
     */
    function addServiceToTOnNe(string memory _id, address _serviceContract) external onlyOwner {
        require(address(activeTOnNe) != address(0), "STUB: TOnNe not set");
        activeTOnNe.addService(_id, _serviceContract);
    }
    
    /**
     * @notice Creates and issues a new Ticket instance.
     * @dev Only callable by a registered Transport Service Provider (TSP). Generates a unique ID using block data and nonce, deploys the new Ticket contract, and stores its address.
     * @param _customer The wallet address of the customer receiving the ticket.
     * @param _serviceId The service (route) identifier.
     * @param _originStopId The ticket's origin stop.
     * @param _destinationStopId The ticket's destination stop.
     * @param _ticketType The product type (e.g., single ride, daily pass).
     * @return The unique 32-byte ID of the newly issued ticket.
     */
    function issueTicket(
        address _customer,
        string memory _serviceId,
        string memory _originStopId,
        string memory _destinationStopId,
        string memory _ticketType
    ) public returns (bytes32) { 
        
        require(activeTOnNe.registeredOrganisations(msg.sender), "STUB: Issuer is not a registered TSP");
        
        bytes32 ticketId = keccak256(abi.encodePacked(
            block.timestamp, msg.sender, _customer, ticketNonce
        ));
        ticketNonce++;
        
        Ticket newTicket = new Ticket(
            ticketId,
            _customer,
            _serviceId,
            _originStopId,
            _destinationStopId,
            _ticketType,
            msg.sender,
            address(activeTOnNe)
        );
        
        issuedTickets[ticketId] = address(newTicket);
        emit TicketIssued(ticketId, _customer, msg.sender);
        
        return ticketId;
    }
    
    /**
     * @notice Retrieves the contract address and issuer address for a given ticket ID.
     * @dev Used by off-chain middleware to verify the existence and legitimacy of a ticket before validation.
     * @param _ticketId The unique ID of the ticket to query.
     * @return ticketAddress The contract address of the Ticket instance.
     * @return issuerAddress The address of the TSP that originally issued the ticket.
     */
    function getTicketDetails(bytes32 _ticketId) 
        external 
        view 
        returns (address ticketAddress, address issuerAddress) 
    {
        ticketAddress = issuedTickets[_ticketId];
        require(ticketAddress != address(0), "STUB: Ticket does not exist");
        
        Ticket ticket = Ticket(ticketAddress);
        issuerAddress = ticket.issuer();
    }
}