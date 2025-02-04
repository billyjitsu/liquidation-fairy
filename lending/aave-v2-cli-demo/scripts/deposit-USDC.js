const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
require('dotenv').config();

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
const USDCTokenAddress = references.USDCWithFaucet;
const LendingPoolAddress = deployedContracts.LendingPool.custom.address;

console.log('USDC Token Address:', USDCTokenAddress);
console.log('Lending Pool Address:', LendingPoolAddress);

const mnemonic = process.env.MNEMONIC;
const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL);
const wallet = ethers.Wallet.fromMnemonic(mnemonic);
const signer = wallet.connect(provider);

console.log('Wallet Address', wallet.address);

const USDCTokenAbi = [
  'function approve(address spender, uint256 amount) public returns (bool)',
  'function balanceOf(address account) public view returns (uint256)',
  'function transfer(address recipient, uint256 amount) public returns (bool)',
  'function faucet()public payable',
  'function allowance(address owner, address spender) public view returns (uint256)'
];

const lendingPoolAbi = [
  'function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) public',
  'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) public',
  'function getUserAccountData(address user) public view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)'
];

const usdcToken = new ethers.Contract(USDCTokenAddress, USDCTokenAbi, signer);
const lendingPool = new ethers.Contract(LendingPoolAddress, lendingPoolAbi, signer);
const referralCode = 0;

console.log("About to deposit USDC Tokens to LendingPool");
const depositUSDCTokensToLendingPool = async () => {
  try {
    const amount = ethers.utils.parseUnits('1000000', 6);
    console.log('Wallet Address', wallet.address);

    // Check USDC balance
    const balance = await usdcToken.balanceOf(wallet.address);
    console.log('USDC Balance:', ethers.utils.formatUnits(balance, 6));

    console.log('Approving USDC Tokens for LendingPool...');
    const approveTx = await usdcToken.approve(LendingPoolAddress, amount, {
      gasLimit: 500000 // Increased gas limit
    });
    await approveTx.wait();
    console.log('Approval transaction completed');

    console.log('Depositing USDC Tokens to LendingPool...');
    const depositTx = await lendingPool.deposit(
      USDCTokenAddress,
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
    throw error; // Re-throw the error to be caught in the main function
  }
};

// Main execution function
async function main() {
  try {
    await depositUSDCTokensToLendingPool();
    console.log('Deposit completed successfully.');
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