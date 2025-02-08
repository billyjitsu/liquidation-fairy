const hre = require("hardhat");
const fs = require("fs");
require("dotenv").config();

const main = async () => {
    const contractName = "MultiSigWallet"; // Add your desired name here
    console.log(`Deploying MultiSig contract with name: ${contractName}...`);


    const privateKey = process.env.PRIVATE_KEY;
    const wallet = new ethers.Wallet(privateKey);
    
    const Multisig = await hre.ethers.getContractFactory(contractName);
    const multisig = await Multisig.deploy( [wallet.address], 1 );
    await multisig.waitForDeployment();
    
    const deployedAddress = await multisig.getAddress();
    
    console.log(`Deployed MultiSig at ${deployedAddress}`);

    // Save deployment info with name
    const deploymentInfo = {
        name: contractName,
        address: deployedAddress
    };

    // Save deployment info
    fs.writeFileSync('references.json', JSON.stringify(deploymentInfo, null, 2));
    console.log('Deployments saved to references.json');
};

// Handle errors
main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });