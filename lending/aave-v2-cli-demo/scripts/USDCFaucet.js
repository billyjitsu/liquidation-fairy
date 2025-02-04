const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
require('dotenv').config();

// Read JSON file
const referencesPath = path.join(__dirname, '../api3-adaptors/references.json');

let references;

try {
  references = JSON.parse(fs.readFileSync(referencesPath, 'utf8'));
} catch (error) {
  console.error('Error reading JSON file:', error.message);
  process.exit(1);
}

// Get USDC Token address
const USDCTokenAddress = references.USDCWithFaucet;

console.log('USDC Token Address:', USDCTokenAddress);

const mnemonic = process.env.MNEMONIC;
const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL);
// Use the second generated address from the mnemonic
const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic);
const wallet = new ethers.Wallet(hdNode.derivePath("m/44'/60'/0'/0/0")).connect(provider);

console.log('Wallet Address', wallet.address);

const USDCTokenAbi = [
  'function faucet() public',
  'function balanceOf(address account) public view returns (uint256)',
  'function decimals() public view returns (uint8)'
];

const usdcToken = new ethers.Contract(USDCTokenAddress, USDCTokenAbi, wallet);

const callUsdcFaucet = async () => {
  try {
    // Get initial balance
    const initialBalance = await usdcToken.balanceOf(wallet.address);
    const decimals = await usdcToken.decimals();
    console.log('Initial USDC Balance:', ethers.utils.formatUnits(initialBalance, decimals));

    console.log('Calling USDC faucet...');
    const faucetTx = await usdcToken.faucet();
    console.log('Faucet transaction sent. Waiting for confirmation...');
    await faucetTx.wait();
    console.log('Faucet transaction confirmed');

    // Get new balance
    const newBalance = await usdcToken.balanceOf(wallet.address);
    console.log('New USDC Balance:', ethers.utils.formatUnits(newBalance, decimals));

    // Calculate received amount
    const receivedAmount = newBalance.sub(initialBalance);
    console.log('Received USDC:', ethers.utils.formatUnits(receivedAmount, decimals));

  } catch (error) {
    console.error('Error:', error.message);
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
async function main() {
  try {
    await callUsdcFaucet();
    console.log('USDC faucet process completed.');
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