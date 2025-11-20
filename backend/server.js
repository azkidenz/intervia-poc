require('dotenv').config();
const express = require('express');
const { ethers } = require('ethers'); 
const axios = require('axios');

// Load contract artifacts
const deploymentData = require('./deployed-addresses.json');
const STUB_ABI = require('./artifacts/contracts/registry/STUB.sol/STUB.json').abi;
const TOnNe_ABI = require('./artifacts/contracts/network/TransportNetworkOntology.sol/TransportNetworkOntology.json').abi;
const Ticket_ABI = require('./artifacts/contracts/network/Ticket.sol/Ticket.json').abi;
const Service_ABI = require('./artifacts/contracts/network/Service.sol/Service.json').abi;

// Connection setup
const provider = new ethers.JsonRpcProvider(process.env.BESU_RPC_URL);
const issuerWallet = new ethers.Wallet(process.env.ISSUER_PRIVATE_KEY, provider); // Intervia_Issuer
const validatorWallet = new ethers.Wallet(process.env.VALIDATOR_GATE_PRIVATE_KEY, provider); // Intervia_Validator

const stubContract = new ethers.Contract(deploymentData.stubAddress, STUB_ABI, provider);
const tonneContract = new ethers.Contract(deploymentData.tonneAddress, TOnNe_ABI, provider);

// Stardog helper
const stardogBaseURL = `${process.env.STARDOG_ENDPOINT}/${process.env.STARDOG_DB}`;
const stardogAuth = { username: process.env.STARDOG_USER, password: process.env.STARDOG_PASS };

// Express setup
const app = express();
app.use(express.json());
const PORT = 3000;

// Issuance (POST /issueTicket)
app.post('/issueTicket', async (req, res) => {
    const { customerAddress, serviceId, originStopId, destinationStopId, ticketType } = req.body; 
    console.log(`Received issuance request [${ticketType}] for ${customerAddress}...`);

    let ticketId; 
    try {
        const { stardogRoute, stardogHash } = await getOffChainData(serviceId); 
        const onChainHash = await getOnChainHash(serviceId);
        
        if (stardogHash !== onChainHash)
            return res.status(503).json({ success: false, message: "Unable to issue, Off-Chain network data not synchronized." });
        
        if (!stardogRoute.includes(originStopId) || !stardogRoute.includes(destinationStopId))
            return res.status(400).json({ success: false, message: `Impossible to issue ticket: origin (${originStopId}) or destination (${destinationStopId}) stations are not part of the requested line (${serviceId}).` });

        const tx = await stubContract.connect(issuerWallet).issueTicket(
            customerAddress, serviceId, originStopId, destinationStopId, ticketType
        );
        const receipt = await tx.wait();

        const eventTopic = stubContract.interface.getEvent("TicketIssued").topicHash;
        const event = receipt.logs.find(log => log.address.toLowerCase() === deploymentData.stubAddress.toLowerCase() && log.topics[0] === eventTopic);
        if (!event) throw new Error("TicketIssued event not found.");
        const decodedEvent = stubContract.interface.decodeEventLog('TicketIssued', event.data, event.topics);
        ticketId = decodedEvent.ticketId;
        
        console.log(`Ticket ${ticketId} issued (On-Chain).`);
    } catch (e) {
        return res.status(500).json({ success: false, message: `On-Chain failure: ${e.message}` });
    }

    try {
        const ticketUriSubject = `TICKET_${ticketId.substring(2)}`;
        const sparqlInsert = `
            PREFIX ex: <https://intervia.space/intervia#>
            PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
            INSERT DATA {
                ex:${ticketUriSubject} a ex:Ticket ;
                    ex:onChainID "${ticketId}" ;
                    ex:hasOwner "${customerAddress}"^^xsd:string ; 
                    ex:forService ex:${serviceId} ;
                    ex:ticketType "${ticketType}"^^xsd:string .
            }
        `;
        await queryStardogUpdate(sparqlInsert);
        console.log(`Ticket ${ticketId} registered (Off-Chain) in Stardog.`);
        
        res.status(201).json({ 
            success: true, 
            message: "Ticket issued and synchronized.",
            data: { ticketId: ticketId } 
        });

    } catch (e) {
        res.status(202).json({ 
            success: true, 
            message: "On-Chain issuance successful, but Off-Chain synchronization failed.",
            data: { ticketId: ticketId }
        });
    }
});

// Activation (POST /activateTicket)
app.post('/activateTicket', async (req, res) => {
    const { ticketId, currentStationId, customerAddress } = req.body; 
    try {
        const { ticketContract, serviceId, ticketType, currentState } = await getTicketData(ticketId, customerAddress);

        if (currentState !== 0n) { // 0 = Issued
            return res.status(409).json({ success: false, message: "Ticket already activated or expired." });
        }
        
        // Proof-of-Validlty
        const { stardogHash, stardogRoute } = await getOffChainData(serviceId);
        const onChainHash = await getOnChainHash(serviceId);
        
        if (stardogHash !== onChainHash) {
            return res.status(503).json({ success: false, message: "Off-Chain data not synchronized." });
        }
        
        // Logic check
        const isValid = await checkValidationLogic(ticketContract, currentStationId, stardogRoute);
        if (!isValid) {
             return res.status(403).json({ success: false, message: `Ticket non valid for ${currentStationId} station.` });
        }

        
        // Start On-Chain update
        const tx = await ticketContract.connect(validatorWallet).activate(currentStationId);
        await tx.wait();
        
        res.status(200).json({ success: true, message: "Ticket activated." });

    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Inspection (POST /inspectTicket)
app.post('/inspectTicket', async (req, res) => {
    const { ticketId, customerAddress, currentStationId } = req.body; 
    
    try {
        // 1. On-Chain Evaluation
        const { ticketContract, serviceId, ticketType, currentState, activationTime } = await getTicketData(ticketId, customerAddress, true);
        if (currentState === 0n) // Issued
            return res.status(409).json({ success: false, message: "Ticket not activated." });
        else if (currentState === 2n) // Expired
            return res.status(410).json({ success: false, message: "Ticket expired." });
        
        // 2. Activated ticket check and expiration evaluation
        const { maxDurationSeconds, stardogHash, stardogRoute } = await getOffChainData(serviceId);
        const currentTime = Math.floor(Date.now() / 1000);
        const elapsed = currentTime - Number(activationTime);

        if (elapsed > maxDurationSeconds) {
            await ticketContract.connect(validatorWallet).forceExpire(); 
            return res.status(410).json({ success: false, message: "Maximum duration exceeded." });
        }

        // 3. Proof-of-Validity
        const onChainHash = await getOnChainHash(serviceId);
        if (stardogHash !== onChainHash) {
            return res.status(503).json({ success: false, message: "Off-chain data not synchronized." });
        }

        // 4. Logic check and agreements
        const isValid = await checkValidationLogic(ticketContract, currentStationId, stardogRoute);
        if (!isValid)
             return res.status(403).json({ success: false, message: `Ticket not valid for ${currentStationId} station.`, data: {service: serviceId} });

        res.status(200).json({ 
            success: true, 
            message: `Ticket inspected and valid. Remaining time:: ${Math.floor((maxDurationSeconds - elapsed) / 60)} min.`,
            data: {
                service: serviceId
            }
        });

    } catch (e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`\nIntervia middleware is listening on http://localhost:${PORT}`);
});

// Helper to centralize ticket data retrieval
async function getTicketData(ticketId, customerAddress, includeTimestamp = false) {
    // Existence check
    const { ticketAddress } = await stubContract.getTicketDetails(ticketId);
    if (ticketAddress === ethers.ZeroAddress) {
        throw new Error("Ticket not found.");
    }
    
    // Load contract
    const ticketContract = new ethers.Contract(ticketAddress, Ticket_ABI, provider);
    
    // 3. PoO (Proof of Ownership) Check
    const onChainOwner = await ticketContract.customerAddress();
    if (onChainOwner.toLowerCase() !== customerAddress.toLowerCase()) {
        throw new Error("Ticket owner not valid.");
    }
    
    // Retrieve Data
    const serviceId = await ticketContract.serviceId();
    const ticketType = await ticketContract.ticketType();
    const currentState = await ticketContract.currentState();
    
    let activationTime = 0n;
    if (includeTimestamp) {
        activationTime = await ticketContract.activationTimestamp();
    }
    
    return { ticketContract, serviceId, ticketType, currentState, activationTime };
}

// Helper to centralize PoV
async function getOffChainData(serviceId) {
    const sparqlSelect = `
        PREFIX ex: <https://intervia.space/intervia#>
        SELECT ?merkleHash ?duration (GROUP_CONCAT(REPLACE(STR(?routeStop), ".*#", ""); separator=",") AS ?route)
        WHERE {
            ex:${serviceId} ex:merkleHash ?merkleHash ;
                          ex:maxDurationMinutes ?duration ;
                          ex:followsRoute ?routeStop .
        }
        GROUP BY ?merkleHash ?duration
    `;
    
    const stardogResult = await queryStardogRead(sparqlSelect);
    if (stardogResult.length === 0) {
        throw new Error(`Off-Chain data not found for service ${serviceId}.`);
    }
    
    const stardogHash = stardogResult[0].merkleHash.value;
    const stardogRoute = stardogResult[0].route.value.split(',');
    const maxDurationMinutes = parseInt(stardogResult[0].duration.value);
    const maxDurationSeconds = maxDurationMinutes * 60;

    return { stardogHash, stardogRoute, maxDurationSeconds };
}

// Helper for On-Chain hash
async function getOnChainHash(serviceId) {
    const serviceAddress = await tonneContract.services(serviceId);
    if (serviceAddress === ethers.ZeroAddress) {
        throw new Error(`Service ID ${serviceId} not found On-Chain.`);
    }
    const serviceContract = new ethers.Contract(serviceAddress, Service_ABI, provider);
    return await serviceContract.getHashDigest();
}

// Helper for business logic
async function checkValidationLogic(ticketContract, currentStationId, stardogRoute) {
    // Basic route check
    if (stardogRoute.includes(currentStationId))
        return true;

    // Agreement check
    const serviceId = await ticketContract.serviceId();

    const agreementQuery = `
        PREFIX ex: <https://intervia.space/intervia#>
        
        ASK WHERE {
            ex:${serviceId} ex:hasOwner ?tspTicket .

            ?serviceStazione ex:followsRoute ex:${currentStationId} .
            ?serviceStazione ex:hasOwner ?tspStation .
            
            FILTER(?tspTicket != ?tspStation) 
            
            { ?tspTicket ex:hasAgreementWith ?tspStation . } 
            UNION
            { ?tspTicket ex:hasTemporalAgreement [ ex:withTSP ?tspStation ] . }
        }
    `;
    
    const agreementResult = await queryStardogRead(agreementQuery);
    
    return agreementResult[0]?.ASK?.value === true;
}

// Stardog helper (Read)
async function queryStardogRead(sparqlQuery) {
    try {
        const response = await axios.post(
            `${stardogBaseURL}/query`, 
            sparqlQuery, 
            { auth: stardogAuth, headers: {'Content-Type': 'application/sparql-query', 'Accept': 'application/sparql-results+json'} }
        );
        if (typeof response.data.boolean === 'boolean') {
            return [{ "ASK": { "value": response.data.boolean } }];
        }
        return response.data.results.bindings;
    } catch (error) {
        console.error("Stardog query error (Read):", error.response ? error.response.data : error.message);
        throw new Error("Unable to query the DKG.");
    }
}

// Stardog Helper (Update)
async function queryStardogUpdate(sparqlQuery) {
    try {
        await axios.post(
            `${stardogBaseURL}/update`, 
            sparqlQuery, 
            { auth: stardogAuth, headers: {'Content-Type': 'application/sparql-update', 'Accept': 'application/json'} }
        );
    } catch (error) {
        console.error("Stardog query error (Update):", error.response ? error.response.data : error.message);
        throw new Error("Unable to query the DKG.");
    }
}