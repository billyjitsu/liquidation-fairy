const { ethers } = require('ethers');
require('dotenv').config();
const path = require('path');
const referenceData = require(path.join(__dirname, '..', 'api3-adaptors', 'references.json'));

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
const wallet1 = new ethers.Wallet(hdNode.derivePath("m/44'/60'/0'/0/0")).connect(provider);
console.log('Main Wallet Address:', wallet1.address);

// Derive the second wallet (second wallet in the derivation path)
const wallet2 = new ethers.Wallet(hdNode.derivePath("m/44'/60'/0'/0/1")).connect(provider);
console.log('Second Wallet Address:', wallet2.address);

// Extract assets from the imported JSON data
const assets = [
  ...referenceData.assets,
  { assetSymbol: "USDC", ERC20: referenceData.USDCWithFaucet },
  { assetSymbol: "WETH", ERC20: referenceData.MockWETH }
];

// Burn address (Replace with the official burn address for each token if available)
const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';

async function burnAllTokens(wallet, walletName) {
  const signer = wallet;

  for (const asset of assets) {
    const tokenContract = new ethers.Contract(asset.ERC20, ERC20_ABI, signer);
    
    // Get token decimals
    const decimals = await tokenContract.decimals();
    
    // Check balance
    const balance = await tokenContract.balanceOf(wallet.address);
    console.log(`${walletName} - Balance of ${asset.assetSymbol}: ${ethers.utils.formatUnits(balance, decimals)}`);
    
    if (balance.gt(0)) {
      // Burn all tokens by sending to the burn address
      try {
        const tx = await tokenContract.transfer(BURN_ADDRESS, balance);
        await tx.wait();
        console.log(`${walletName} - Burned ${ethers.utils.formatUnits(balance, decimals)} ${asset.assetSymbol}`);
      } catch (error) {
        console.error(`${walletName} - Error burning ${asset.assetSymbol}:`, error.message);
      }
    } else {
      console.log(`${walletName} - No ${asset.assetSymbol} balance to burn.`);
    }
  }

  // Check and log ETH balance (but don't burn it)
  const ethBalance = await provider.getBalance(wallet.address);
  console.log(`${walletName} - ETH Balance (not burned): ${ethers.utils.formatEther(ethBalance)} ETH`);
}

async function burnAllWallets() {
  await burnAllTokens(wallet1, "Main Wallet");
  await burnAllTokens(wallet2, "Second Wallet");
}

burnAllWallets().then(() => {
  console.log("Token burning complete for both wallets. All tokens except ETH should now be burned.");
}).catch((error) => {
  console.error("An error occurred:", error);
});