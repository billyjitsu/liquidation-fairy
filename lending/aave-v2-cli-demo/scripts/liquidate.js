const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
require('dotenv').config();

/*
  Liquidation script
  Pays back the debt in USDC and receives the collateral in API3 tokens in this example
*/

// Read JSON files
const referencesPath = path.join(__dirname, '../api3-adaptors/references.json');
const deployedContractsPath = path.join(__dirname, '../deployed-contracts.json');

/* These variables reference the JSON files that were created for deployment.
   Running the scripts seperately, you will have to manually input the asset addresses and lending pool contract address.
*/
let references, deployedContracts;

try {
  references = JSON.parse(fs.readFileSync(referencesPath, 'utf8'));
  deployedContracts = JSON.parse(fs.readFileSync(deployedContractsPath, 'utf8'));
} catch (error) {
  console.error('Error reading JSON files:', error.message);
  process.exit(1);
}

const mnemonic = process.env.MNEMONIC;
const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL);
// Use the second generated address from the mnemonic
const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic);
const wallet = new ethers.Wallet(hdNode.derivePath("m/44'/60'/0'/0/0")).connect(provider);

const userToLiquidate = new ethers.Wallet(hdNode.derivePath("m/44'/60'/0'/0/1")).connect(provider);
console.log('** User to Liquidate:', userToLiquidate.address);

// ABI for LendingPool (only including the liquidationCall function)
const LENDING_POOL_ADDRESS = deployedContracts.LendingPool.custom.address;
const LENDING_POOL_ABI = [
  "function liquidationCall(address collateralAsset, address debtAsset, address user, uint256 debtToCover, bool receiveAToken) external returns (uint256, string memory)",
  "function getUserAccountData(address) view returns (uint256,uint256,uint256,uint256,uint256,uint256)"
];

const liquidationWallet = new ethers.Wallet(hdNode.derivePath("m/44'/60'/0'/0/1")).connect(provider);
console.log('Liquidation Wallet Address:', liquidationWallet.address);
//Aave V2 deployer wallet address
const LIQUIDATION_USER = liquidationWallet.address;

const lendingPool = new ethers.Contract(LENDING_POOL_ADDRESS, LENDING_POOL_ABI, wallet);

// Asset addresses *These addresses you will have to hardcode on a seperate script
const API3_ADDRESS = references.assets.find(asset => asset.assetSymbol === "API3").ERC20;
const USDC_ADDRESS = references.USDCWithFaucet;

console.log('Lending Pool Address:', LENDING_POOL_ADDRESS);
console.log('API3 Address:', API3_ADDRESS);
console.log('USDC Address:', USDC_ADDRESS);

// Function to get detailed user data and calculate liquidation amounts
const getUserData = async (userAddress) => {
  try {
    console.log('\nFetching detailed user position data...');
    const userData = await lendingPool.getUserAccountData(userAddress);
    
    // Parse all the returned data
    const [
      totalCollateralETH,
      totalDebtETH,
      availableBorrowsETH,
      currentLiquidationThreshold,
      ltv,
      healthFactor
    ] = userData;

    // Convert values to readable format
    const formatEth = (value) => ethers.utils.formatUnits(value, 18);
    
    // Calculate max liquidatable amount (50% of total debt in Aave V2)
    const maxLiquidatableAmount = totalDebtETH.mul(50).div(100);

    // For liquidation threshold and LTV, we should divide by 1e4 since they're in basis points
    const formattedLiquidationThreshold = currentLiquidationThreshold.div(100);  // Convert from basis points
    const formattedLTV = ltv.div(100);  // Convert from basis points

    console.log('\nPosition Details:');
    console.log('------------------');
    console.log(`Total Collateral (ETH): ${formatEth(totalCollateralETH)}`);
    console.log(`Total Debt (ETH): ${formatEth(totalDebtETH)}`);
    console.log(`Available Borrows (ETH): ${formatEth(availableBorrowsETH)}`);
    console.log(`Liquidation Threshold: ${formattedLiquidationThreshold}%`);
    console.log(`LTV: ${formattedLTV}%`);
    console.log(`Health Factor: ${formatEth(healthFactor)}`);
    console.log(`Max Liquidatable Amount (ETH): ${formatEth(maxLiquidatableAmount)}`);

    return {
      totalCollateralETH,
      totalDebtETH,
      maxLiquidatableAmount,
      healthFactor
    };
  } catch (error) {
    console.error('Error getting user data:', error);
    throw error;
  }
};

// Add function to check health factor
const checkHealthFactor = async (userAddress) => {
  try {
    console.log('\nChecking health factor...');
    const userData = await lendingPool.getUserAccountData(userAddress);
    console.log('User Data:', userData);

    // Health Factor is the 6th element (index 5) in the array
    const healthFactor = userData[5];
    
    if (!healthFactor) {
      throw new Error('Health factor is undefined');
    }

    // Convert health factor from wei to decimal
    const healthFactorDecimal = ethers.utils.formatUnits(healthFactor, 18);
    console.log(`Health Factor: ${healthFactorDecimal}`);
    
    // Return true if health factor is less than 1 (position is liquidatable)
    return healthFactor.lt(ethers.utils.parseUnits("1", 18));
  } catch (error) {
    console.error('Error checking health factor:', error);
    throw error;
  }
};

const performLiquidation = async () => {
  // Approve USDC spending if necessary (assuming you have enough USDC)
  const usdcContract = new ethers.Contract(USDC_ADDRESS, ['function approve(address spender, uint256 amount) public returns (bool)'], wallet);
  const maxUint256 = ethers.constants.MaxUint256;
  await usdcContract.approve(LENDING_POOL_ADDRESS, maxUint256);

  try {
    // Get detailed position data before liquidation
    const positionData = await getUserData(LIQUIDATION_USER);
    console.log('\nPreparing for liquidation...');
    console.log(`Maximum amount that can be liquidated: ${ethers.utils.formatUnits(positionData.maxLiquidatableAmount, 18)} ETH`);

    // Perform liquidation
    // We're setting debtToCover to MaxUint256 to repay the maximum amount possible
    const tx = await lendingPool.liquidationCall(
      API3_ADDRESS,  // collateralAsset
      USDC_ADDRESS,  // debtAsset
      LIQUIDATION_USER,
      maxUint256,    // debtToCover (max uint256 to repay maximum amount)
      false          // receiveAToken (false to receive the underlying asset)
    );

    console.log('Liquidation transaction sent:', tx.hash);
    await tx.wait();
    console.log('Liquidation successful!');

    // Get position data after liquidation
    console.log('\nFetching position data after liquidation...');
    const postLiquidationData = await getUserData(LIQUIDATION_USER);
    
    // Calculate the difference
    const debtReduced = positionData.totalDebtETH.sub(postLiquidationData.totalDebtETH);
    console.log(`\nDebt reduced by: ${ethers.utils.formatUnits(debtReduced, 18)} ETH`);

  } catch (error) {
    console.error('Liquidation failed:', error);
    if (error.error && error.error.message) {
      console.error('Detailed error:', error.error.message);
    }
    // Log transaction details if available
    if (error.transaction) {
      console.error('Transaction details:', JSON.stringify(error.transaction, null, 2));
    }
  }
};

// Main execution function
const main = async () => {
  try {
    // Add check for health factor before liquidation
    const isLiquidatable = await checkHealthFactor(userToLiquidate.address);

    if (!isLiquidatable) {
      console.log('Position is healthy (Health Factor >= 1). Aborting liquidation.');
      return;
    }

    console.log('Position is unhealthy. Proceeding with liquidation...');

    await performLiquidation();
    console.log('Liquidation process completed.');
  } catch (error) {
    console.error('An error occurred in the main execution:', error.message);
  }
};

// Run the main function
main()
  .then(() => console.log('All operations completed.'))
  .catch((error) => console.error('Unhandled error in main execution:', error));