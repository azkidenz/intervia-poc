// This is a sample Hardhat deployment script. All hardcoded addresses are replaced with placeholders for public safety.
const { ethers } = require("hardhat");
const fs = require("fs");

const VALIDATOR_TSPS_DATA = [
    { id: "T1", address: "0x0000000000000000000000000000000000000006" },
    { id: "T2", address: "0x0000000000000000000000000000000000000007" },
    { id: "T3", address: "0x0000000000000000000000000000000000000008" },
    { id: "T4", address: "0x0000000000000000000000000000000000000009" }
];

const ALL_STOP_IDS = ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8", "S9", "S10", "S11", "S12", "S13", "S14", "S15", "S16", "S17", "S18"];

const ALL_SERVICES_DATA = [
    { id: "L1E", ownerId: "T1", route: ["S13", "S12", "S3", "S1", "S10", "S18"] },
    { id: "L2B", ownerId: "T2", route: ["S14", "S5", "S15", "S7", "S17", "S10", "S1", "S11"] },
    { id: "L3M", ownerId: "T3", route: ["S1", "S11", "S2", "S3", "S12", "S16", "S1"] },
    { id: "L4T", ownerId: "T2", route: ["S9", "S6", "S17", "S15", "S2", "S11", "S12"] },
    { id: "L5R", ownerId: "T1", route: ["S4", "S3", "S12", "S6", "S18"] },
    { id: "L6F", ownerId: "T4", route: ["S8", "S15", "S17", "S7"] }
];

const getTspAddress = (id) => VALIDATOR_TSPS_DATA.find(t => t.id === id).address;

async function main() {
    console.log("Starting full Intervia network deployment...");
    
    // 1. Load Signers (All 9 accounts from hardhat.config.js)
    const [
        Intervia_Network,     // Admin (0x...0001)
        Intervia_Issuer,      // (0x...0002)
        Intervia_Validator,   // (0x...0003)
        Client_Bob,           // (0x...0004)
        Client_Alice,         // (0x...0005)
        TSP1_Signer, // T1 (0x...0006)
        TSP2_Signer, // T2 (0x...0007)
        TSP3_Signer, // T3 (0x...0008)
        TSP4_Signer  // T4 (0x...0009)
    ] = await ethers.getSigners();
    
    // Map IDs to correct signers
    const signerMap = new Map();
    signerMap.set("T1", TSP1_Signer);
    signerMap.set("T2", TSP2_Signer);
    signerMap.set("T3", TSP3_Signer);
    signerMap.set("T4", TSP4_Signer);

    console.log(`Admin signer: ${Intervia_Network.address}`);

    // 2. Base contract deployments

    console.log("\nDeploying base contracts...");

    const TOnNeFactory = await ethers.getContractFactory("TransportNetworkOntology", Intervia_Network);
    const STUBFactory = await ethers.getContractFactory("STUB", Intervia_Network);
    const TSPFactory = await ethers.getContractFactory("TransportServiceProvider", Intervia_Network);
    const StopFactory = await ethers.getContractFactory("Stop", Intervia_Network);
    const ServiceFactory = await ethers.getContractFactory("Service", Intervia_Network);

    const tonne = await TOnNeFactory.deploy();
    await tonne.waitForDeployment();
    const stub = await STUBFactory.deploy(await tonne.getAddress());
    await stub.waitForDeployment();

    console.log(`\nSTUB registry deployed at: ${await stub.getAddress()}`);

    const tx = await tonne.connect(Intervia_Network).transferAdmin(await stub.getAddress());
    await tx.wait();

    // 3. Registration and population
    console.log("\nDeploying and registering TSPs...");

    // Deploy and Register the 4 TSP Contracts
    for (const tspData of VALIDATOR_TSPS_DATA) {
        const tspContract = await TSPFactory.deploy(tspData.id, tspData.address);
        await tspContract.waitForDeployment();
        await stub.registerOrganisation(await tspContract.getAddress());
    }
    
    // Register Application Accounts (Issuer and Validator)
    await stub.registerOrganisation(Intervia_Issuer.address);
    await stub.registerOrganisation(Intervia_Validator.address);

    // Deploy the 18 Stops
    console.log("\nDeploying stops...");
    const StopContractMap = new Map();
    for (const stopId of ALL_STOP_IDS) {
        const stopContract = await StopFactory.deploy(stopId);
        await stopContract.waitForDeployment();
        StopContractMap.set(stopId, await stopContract.getAddress());
    }
    console.log(`\nDeployed ${ALL_STOP_IDS.length} stop contracts.`);

    // 4. Deploy and populate services
    console.log("\nDeploying and populating services...");
    const ServiceContractMap = new Map();
    
    for (const serviceData of ALL_SERVICES_DATA) {
        const ownerAddress = getTspAddress(serviceData.ownerId);
        const ownerSigner = signerMap.get(serviceData.ownerId); 
        
        // Deploy service
        const serviceContract = await ServiceFactory.deploy(serviceData.id, ownerAddress);
        await serviceContract.waitForDeployment();
        
        // Register in TOnNe
        await stub.addServiceToTOnNe(serviceData.id, await serviceContract.getAddress());
        
        // Populate route 
        for (const stopId of serviceData.route)
            await serviceContract.connect(ownerSigner).addPlannedStop(StopContractMap.get(stopId));
        
        ServiceContractMap.set(serviceData.id, serviceContract);
        console.log(`\nDeployed and populated service ${serviceData.id} (owner: ${serviceData.ownerId}).`);
    }
    
    console.log("\nTOnNe network deployment complete.");

    // Save deployed addresses
    
    const serviceAddresses = {};
    for (const [id, contract] of ServiceContractMap.entries()) {
        serviceAddresses[id] = await contract.getAddress();
    }

    const deploymentData = {
        stubAddress: await stub.getAddress(),
        tonneAddress: await tonne.getAddress(),
        serviceAddresses: serviceAddresses
    };

    // Save data to file
    fs.writeFileSync(
        "./deployed-addresses.json", 
        JSON.stringify(deploymentData, null, 2)
    );

    console.log("Addresses saved successfully.");
    console.log(JSON.stringify(deploymentData, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});