const { ethers } = require('ethers');
require('dotenv').config();
const path = require('path');
const referenceData = require(path.join(__dirname, '..', 'api3-adaptors', 'references.json'));

// Simplified wallet setup
const mnemonic = process.env.MNEMONIC;
const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL);
const wallet = ethers.Wallet.fromMnemonic(mnemonic);
const signer = wallet.connect(provider);

// Correct ABI for the contract functions
const abi = [
  "function updateValue(int224 _value) external",
];

const mockProxyAddress = referenceData.MockProxy; 

async function updatePriceValue() {
  // Create contract instance
  const contract = new ethers.Contract(mockProxyAddress, abi, signer);

  try {
    console.log(`Updating mock proxy price`);
  
    const newValue = 1019903720000000000n; 

    // Call updateValue function
    const tx = await contract.updateValue(newValue);
    console.log('Transaction sent:', tx.hash);
    
    // Wait for transaction to be mined
    await tx.wait();
    console.log('Transaction confirmed');

  } catch (error) {
    console.error('Error:', error.message);
    if (error.data) {
      console.error('Error data:', error.data);
    }
  }
}

async function main() {
  await updatePriceValue();
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });