const hre = require("hardhat");
const fs = require("fs");
const path = require('path');

module.exports = async () => {
    let data = fs.readFileSync('../api3-adaptors/config.json', 'utf8');
    const deployedContractsPath = path.join(__dirname, '../../deployed-contracts.json');
    let config, deployedContracts;
    try {
        config = JSON.parse(data);
    }
    catch (err) {
        console.error('Error parsing config file:', err);
        return;
    }
    let deploymentsConfig = {
        assets: []
    };

    try {
        deployedContracts = JSON.parse(fs.readFileSync(deployedContractsPath, 'utf8'));
    } catch (error) {
        console.error('Error reading JSON files:', error.message);
        process.exit(1);
    }

    const LendingPoolAddressProvider = deployedContracts.LendingPoolAddressesProvider.custom.address;
    console.log('LendingPoolAddressProvider:', LendingPoolAddressProvider);

    // Deploy Dex
    const GenericDex = await hre.deployments.deploy("GenericDex", {
        args: [],
        from: (await hre.getUnnamedAccounts())[0],
        log: true,
    });
    deploymentsConfig['GenericDex'] = GenericDex.address;

    // Deploy Starter FlashLoan
    const FlashLoanDex = await hre.deployments.deploy("FlashLoanDex", {
        args: [LendingPoolAddressProvider, GenericDex.address],
        from: (await hre.getUnnamedAccounts())[0],
        log: true,
    });
    deploymentsConfig['FlashLoanDex'] = FlashLoanDex.address;

    // Deploy FlashLoan with Liquidaiton and Dex
    const FlashLoanLiquidationSwap = await hre.deployments.deploy("FlashLoanLiquidationSwap", {
        args: [LendingPoolAddressProvider, GenericDex.address],
        from: (await hre.getUnnamedAccounts())[0],
        log: true,
    });
    deploymentsConfig['FlashLoanLiquidationSwap'] = FlashLoanLiquidationSwap.address;


    fs.writeFileSync('liquidationReferences.json', JSON.stringify(deploymentsConfig, null, 2));
    console.log('Deployments saved to liquidationReferences.json');
};

module.exports.tags = ['deployLiquidationTools'];