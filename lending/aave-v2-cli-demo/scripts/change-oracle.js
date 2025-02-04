const { ethers } = require('ethers');
require('dotenv').config();
const path = require('path');
const referenceData = require(path.join(__dirname, '..', 'api3-adaptors', 'references.json'));
const configData = require(path.join(__dirname, '..', 'api3-adaptors', 'config.json'));

// Simplified wallet setup
const mnemonic = process.env.MNEMONIC;
const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL);
const wallet = ethers.Wallet.fromMnemonic(mnemonic);
const signer = wallet.connect(provider);

// Correct ABI for the contract functions
const abi = [
  "function changeProxyAddress(address _assetProxy, address _UsdcUsdProxy) external",
  "function latestAnswer() view returns (int256)",
  "function owner() view returns (address)"
];

// Configuration
const assetToUpdate = "API3"; 
const newAssetProxyAddress = referenceData.MockProxy; // Using MockProxy as the new oracle address

async function updateProxyAddress(assetSymbol, newAssetProxy) {
  const asset = referenceData.assets.find(a => a.assetSymbol === assetSymbol);
  if (!asset) {
    console.error(`Asset ${assetSymbol} not found in references.json`);
    return;
  }

  const contractAddress = asset.Api3AggregatorAdaptor;
  const usdcUsdProxy = configData.UsdcUsdProxyAddress;

  // Create contract instance
  const contract = new ethers.Contract(contractAddress, abi, signer);

  try {
    // Check if the signer is the owner of the contract
    const contractOwner = await contract.owner();
    if (contractOwner.toLowerCase() !== signer.address.toLowerCase()) {
      console.error(`Error: The signer (${signer.address}) is not the owner of the contract (${contractOwner})`);
      return;
    }

    console.log(`Updating proxy addresses for ${assetSymbol}...`);
    console.log(`Contract Address: ${contractAddress}`);
    console.log(`New Asset Proxy: ${newAssetProxy}`);
    console.log(`New USDC/USD Proxy: ${usdcUsdProxy}`);

    // Call changeProxyAddress function
    const tx = await contract.changeProxyAddress(newAssetProxy, usdcUsdProxy);
    console.log('Transaction sent:', tx.hash);
    
    // Wait for transaction to be mined
    await tx.wait();
    console.log('Transaction confirmed');

    // Uncomment these lines if you want to check the value before and after
    // const currentValue = await contract.latestAnswer();
    // console.log('Current value:', currentValue.toString());
    // const newValue = await contract.latestAnswer();
    // console.log('New value:', newValue.toString());

  } catch (error) {
    console.error('Error:', error.message);
    if (error.data) {
      console.error('Error data:', error.data);
    }
  }
}

async function main() {
  await updateProxyAddress(assetToUpdate, newAssetProxyAddress);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });