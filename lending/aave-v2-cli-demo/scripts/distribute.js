const { ethers } = require('ethers');
require('dotenv').config();
const referenceData = require('../api3-adaptors/references.json');

// ABI for ERC20 token (only including the functions we need)
const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
];

// Main wallet setup
const mnemonic = process.env.MNEMONIC;
const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL);

// Create HD Node from mnemonic
const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic);

// Derive the main wallet (first wallet in the derivation path)
const wallet = new ethers.Wallet(hdNode.derivePath("m/44'/60'/0'/0/0")).connect(provider);
const signer = wallet;

console.log('Main Wallet Address:', wallet.address);

// Derive the second wallet (second wallet in the derivation path)
const wallet2 = new ethers.Wallet(hdNode.derivePath("m/44'/60'/0'/0/1")).connect(provider);
console.log('Second Wallet Address:', wallet2.address);

// Extract assets from the imported JSON data
const assets = [
  ...referenceData.assets,
  { assetSymbol: "USDC", ERC20: referenceData.USDCWithFaucet },
  { assetSymbol: "WETH", ERC20: referenceData.MockWETH }
];

async function distributeAssets() {
  for (const asset of assets) {
    const tokenContract = new ethers.Contract(asset.ERC20, ERC20_ABI, signer);
    
    // Get token decimals
    const decimals = await tokenContract.decimals();
    
    // Check balance
    const balance = await tokenContract.balanceOf(wallet.address);
    console.log(`Balance of ${asset.assetSymbol}: ${ethers.utils.formatUnits(balance, decimals)}`);
    
    if (balance.gt(0)) {
      // Calculate 10% of the balance
      const amountToSend = balance.div(10);
      
      // Send 10% of the balance to the second wallet
      try {
        const tx = await tokenContract.transfer(wallet2.address, amountToSend);
        await tx.wait();
        console.log(`Sent ${ethers.utils.formatUnits(amountToSend, decimals)} ${asset.assetSymbol} to ${wallet2.address}`);
      } catch (error) {
        console.error(`Error sending ${asset.assetSymbol}:`, error.message);
      }
    } else {
      console.log(`No ${asset.assetSymbol} balance to distribute.`);
    }
  }

  // // Check and transfer 10% of ETH balance
  // const ethBalance = await provider.getBalance(wallet.address);
  // console.log(`ETH Balance: ${ethers.utils.formatEther(ethBalance)}`);

  // if (ethBalance.gt(0)) {
  //   try {
  //     // Calculate 10% of ETH balance
  //     const tenPercent = ethBalance.div(10);
      
  //     // Estimate gas price and cost
  //     const gasPrice = await provider.getGasPrice();
  //     const gasLimit = 21000; // Standard gas limit for ETH transfer
  //     const gasCost = gasPrice.mul(gasLimit);

  //     // Send 10% of ETH minus gas cost, if there's enough
  //     const amountToSend = tenPercent.sub(gasCost);

  //     if (amountToSend.gt(0)) {
  //       const tx = await wallet.sendTransaction({
  //         to: wallet2.address,
  //         value: amountToSend
  //       });
  //       await tx.wait();
  //       console.log(`Sent ${ethers.utils.formatEther(amountToSend)} ETH to ${wallet2.address}`);
  //     } else {
  //       console.log("Not enough ETH to cover gas costs for 10% transfer.");
  //     }
  //   } catch (error) {
  //     console.error("Error sending ETH:", error.message);
  //   }
  // } else {
  //   console.log("No ETH balance to distribute.");
  // }
}

distributeAssets().then(() => {
  console.log("10% asset distribution complete.");
}).catch((error) => {
  console.error("An error occurred:", error);
});