const axios = require('axios');
const { ethers } = require("hardhat");

const API_URL = 'http://localhost:3000'; 

async function getTestAddresses() {
    const [
        Intervia_Network, 
        Intervia_Issuer, 
        Intervia_Validator, 
        Client_Bob, 
        Client_Alice,
        ...otherSigners
    ] = await ethers.getSigners();
    
    return {
        BOB_ADDR: Client_Bob.address,
        ISSUER_ADDR: Intervia_Issuer.address,
        VALIDATOR_ADDR: Intervia_Validator.address
    };
}

async function callApi(endpoint, data, expectedStatus = 200) {
    try {
        const response = await axios.post(`${API_URL}${endpoint}`, data);
        console.log(`[PASS] ${endpoint} Response: ${response.status} | Body: ${response.data.message || response.data.status}`);
        return response.data;
    } catch (error) {
        const status = error.response ? error.response.status : 'Network Error';
        const msg = error.response ? error.response.data.message : error.message;
        
        if (status === expectedStatus) {
            console.log(`[PASS] ${endpoint} Expected failure ${status} | Msg: ${msg}`);
            return { error: true, message: msg };
        }
        console.error(`[FAIL] ${endpoint} Unexpected failure | Status: ${status} | Error: ${msg}`);
        throw new Error(`Test fail: ${endpoint}`);
    }
}

async function main() {
    const { BOB_ADDR, ISSUER_ADDR, VALIDATOR_ADDR: VALIDATOR_GATE_ADDR } = await getTestAddresses();
    
    // --- 1. HAPPY PATH: Issue a new regional ticket (T1 -> L1E) ---
    console.log("\n--- SCENARIO 1: Issuance ---");
    const issuanceData = await callApi('/issueTicket', {
        customerAddress: BOB_ADDR, serviceId: "L1E", originStopId: "S13", destinationStopId: "S18", ticketType: "r"
    });
    const ticketId = issuanceData.data.ticketId;

    // --- 2. UNHAPPY PATH: Attempt to activate at wrong station ---
    console.log("\n--- SCENARIO 2: Activation failed (wrong origin) ---");
    // The ticket is only valid starting from S13. Attempting S17.
    await callApi('/activateTicket', {
        ticketId: ticketId, currentStationId: "S17", customerAddress: BOB_ADDR
    }, 403);

    // --- 3. HAPPY PATH: Activation ---
    console.log("\n--- SCENARIO 3: Activation ---");
    await callApi('/activateTicket', {
        ticketId: ticketId, currentStationId: "S13", customerAddress: BOB_ADDR
    });

    // --- 4. HAPPY PATH: Valid on route inspection ---
    console.log("\n--- SCENARIO 4: Valid inspection ---");
    // S1 is on the L1E route (S13, S12, S3, S1, S10, S18)
    await callApi('/inspectTicket', {
        ticketId: ticketId, customerAddress: BOB_ADDR, currentStationId: "S1"
    });
    
    // --- 5. HAPPY PATH: Invalid inspection (Off route) ---
    console.log("\n--- SCENARIO 5: Invalid inspection ---");
    // S14 is NOT on the L1E route.
    await callApi('/inspectTicket', {
        ticketId: ticketId, customerAddress: BOB_ADDR, currentStationId: "S14"
    }, 403);

    
    // --- 5. HAPPY PATH: Simple agreement (T1 <-> T3) ---
    console.log("\n--- SCENARIO 5: Agreement T1 <-> T3  ---");
    // S16 is not on the L1E route, but T1 has an agreement with T3.
    await callApi('/inspectTicket', {
        ticketId: ticketId, customerAddress: BOB_ADDR, currentStationId: "S16"
    });

    // --- 6. UNHAPPY PATH: Missing agreement (T1 <-> T2) ---
    console.log("\n--- SCENARIO 6: Missing agreement T1 <-> T2 ---");
    await callApi('/inspectTicket', {
        ticketId: ticketId, customerAddress: BOB_ADDR, currentStationId: "S5"
    }, 403);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});