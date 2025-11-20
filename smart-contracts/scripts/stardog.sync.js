const { ethers } = require("hardhat");
const path = require("path");

// Configuration
const ALL_SERVICE_IDS = ["L1E", "L2B", "L3M", "L4T", "L5R", "L6F"];

let deploymentData;
try {
    const jsonPath = path.resolve(__dirname, "/deployed-addresses.json");
    deploymentData = require(jsonPath);
    
    if (!deploymentData.serviceAddresses || ALL_SERVICE_IDS.some(id => !deploymentData.serviceAddresses[id])) {
        throw new Error("Missing required Service addresses in 'deployed-addresses.json'.");
    }
} catch (e) {
    console.error("Could not load or validate 'deployed-addresses.json'.");
    console.error(e.message);
    process.exit(1);
}

// Main synchronization function
async function main() {
    const serviceHashes = {};
    let success = true;

    for (const serviceId of ALL_SERVICE_IDS) {
        const serviceAddress = deploymentData.serviceAddresses[serviceId];
        
        try {
            const serviceContract = await ethers.getContractAt("Service", serviceAddress);
            const leafHash = await serviceContract.getHashDigest();
            
            serviceHashes[serviceId] = leafHash;
            console.log(`Hash retrieved successfully for ${serviceId}: ${leafHash.substring(0, 10)}...`);

        } catch (e) {
            console.error(`Failed to fetch hash for ${serviceId} at ${serviceAddress}.`);
            console.error(e.message);
            success = false;
        }
    }

    if (!success) {
        console.error("\nNot all hashes were successfully retrieved. Exiting.");
        return;
    }

    const insertData = ALL_SERVICE_IDS.map(id => 
        `    ex:${id} ex:merkleHash "${serviceHashes[id]}"^^xsd:string .`
    ).join('\n');

    const filterData = ALL_SERVICE_IDS.map(id => `ex:${id}`).join(', ');

    const sparqlQuery = `
PREFIX ex: <https://intervia.space/intervia#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

DELETE {
    ?service ex:merkleHash ?oldHash .
}
WHERE {
    ?service ex:merkleHash ?oldHash .
    FILTER(?service IN (${filterData}))
};

INSERT DATA {
${insertData}
}
`;
    console.log(sparqlQuery);
}

main().catch((error) => {
    console.error("\nERROR:", error.message || error);
    process.exitCode = 1;
});