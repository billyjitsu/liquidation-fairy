const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
require('dotenv').config();
// const referencesPath = require('../api3-adaptors/references.json');
// const deployedContractsPath = require('../deployed-contracts.json');

// Read JSON files
const referencesPath = path.join(__dirname, '../api3-adaptors/references.json');
const deployedContractsPath = path.join(__dirname, '../deployed-contracts.json');

let references, deployedContracts;

try {
  references = JSON.parse(fs.readFileSync(referencesPath, 'utf8'));
  deployedContracts = JSON.parse(fs.readFileSync(deployedContractsPath, 'utf8'));
} catch (error) {
  console.error('Error reading JSON files:', error.message);
  process.exit(1);
}

// Get addresses from JSON files
const API3TokenAddress = references.assets.find(asset => asset.assetSymbol === "API3").ERC20;
const LendingPoolAddress = deployedContracts.LendingPool.custom.address;

console.log('API3 Token Address:', API3TokenAddress);
console.log('Lending Pool Address:', LendingPoolAddress);

const mnemonic = process.env.MNEMONIC;
const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL);

// Use the second generated address from the mnemonic
const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic);
const wallet = new ethers.Wallet(hdNode.derivePath("m/44'/60'/0'/0/1")).connect(provider);

console.log('Wallet Address', wallet.address);

const API3TokenAbi = [
  'function approve(address spender, uint256 amount) public returns (bool)',
  'function balanceOf(address account) public view returns (uint256)',
  'function transfer(address recipient, uint256 amount) public returns (bool)',
];

const lendingPoolAbi = [
  'function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) public',
  'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) public',
  'function getUserAccountData(address user) public view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)'
];

const api3Token = new ethers.Contract(API3TokenAddress, API3TokenAbi, wallet);
const lendingPool = new ethers.Contract(LendingPoolAddress, lendingPoolAbi, wallet);
const referralCode = 0;

console.log("About to deposit API3 Tokens to LendingPool");
const depositAPI3TokensToLendingPool = async () => {
  try {
    const amount = ethers.utils.parseUnits('1000', 18); // Assuming API3 has 18 decimals
    console.log('Wallet Address', wallet.address);

    // Check API3 balance
    const balance = await api3Token.balanceOf(wallet.address);
    console.log('API3 Balance:', ethers.utils.formatUnits(balance, 18));

    console.log('Approving API3 Tokens for LendingPool...');
    const approveTx = await api3Token.approve(LendingPoolAddress, amount, {
      gasLimit: 500000 // Increased gas limit
    });
    await approveTx.wait();
    console.log('Approval transaction completed');

    console.log('Depositing API3 Tokens to LendingPool...');
    const depositTx = await lendingPool.deposit(
      API3TokenAddress,
      amount,
      wallet.address,
      referralCode,
      {
        gasLimit: 500000
      }
    );
    await depositTx.wait();
    console.log('Deposit transaction completed');

  } catch (error) {
    console.error('Error:', error.message);
    if (error.error && error.error.message) {
      console.error('Detailed error:', error.error.message);
    }
    throw error; 
  }
};

const checkAccountData = async () => {
  try {
    const accountData = await lendingPool.getUserAccountData(wallet.address);
    console.log('Account Data:');
    console.log('Total Collateral (ETH):', ethers.utils.formatEther(accountData.totalCollateralETH));
    console.log('Total Debt (ETH):', ethers.utils.formatEther(accountData.totalDebtETH));
    console.log('Available Borrows (ETH):', ethers.utils.formatEther(accountData.availableBorrowsETH));
    console.log('Current Liquidation Threshold:', accountData.currentLiquidationThreshold.toString());
    console.log('LTV:', accountData.ltv.toString());
    console.log('Health Factor:', ethers.utils.formatEther(accountData.healthFactor));
  } catch (error) {
    console.error('Error checking account data:', error.message);
  }
};

// Main execution function
async function main() {
  try {
    await depositAPI3TokensToLendingPool();
    console.log('Deposit completed successfully. Checking account data...');
    await checkAccountData();
  } catch (error) {
    console.error('An error occurred in the main execution:', error.message);
  }
}

// Run the main function
main().then(() => {
  console.log('All operations completed.');
}).catch((error) => {
  console.error('Unhandled error in main execution:', error);
});