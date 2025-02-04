const ethers = require('ethers');
require('dotenv').config();
const fs = require('fs');
const path = require('path');


// Read JSON files
const referencesPath = path.join(__dirname, '..', '..', 'api3-adaptors', 'references.json');
const liquidationReferencesPath = path.join(__dirname, '..', '..', 'api3-liquidations', 'liquidationReferences.json');

const references = JSON.parse(fs.readFileSync(referencesPath, 'utf8'));
const liquidationReferences = JSON.parse(fs.readFileSync(liquidationReferencesPath, 'utf8'));

// Contract addresses
const dexAddress = liquidationReferences.GenericDex;
const tokenAAddress = references.assets.find(asset => asset.assetSymbol === 'API3').ERC20;
const tokenBAddress = references.USDCWithFaucet;
// Amount of tokens to deposit
const amountOfTokenA = "100000";
const amountOfTokenB = "100000";

// ABI for the GenericDex contract (you'll need to replace this with the actual ABI)
const dexABI = [
  "function addTokenPairWithDeposit(address _tokenA, address _tokenB, uint256 _rateAtoB, uint256 _rateBtoA, uint256 _amountA, uint256 _amountB)",
  "function previewSwap(address _fromToken, address _toToken, uint256 _amount) view returns (uint256)",
  "function deposit(address _token, uint256 _amount)",
  "function swap(address _fromToken, address _toToken, uint256 _amount)",
  "function getBalance(address _token) view returns (uint256)",
  "function tokenPairs(bytes32) view returns (address, address, uint256, uint256)"
];

// ABI for ERC20 tokens
const erc20ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

async function main() {
  // Connect to the network
  const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL);
  const mnemonic = process.env.MNEMONIC;
  const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic);
  const wallet = new ethers.Wallet(hdNode.derivePath("m/44'/60'/0'/0/0")).connect(provider);
  const signer = wallet;

  // Create contract instances
  const dexContract = new ethers.Contract(dexAddress, dexABI, signer);
  const tokenAContract = new ethers.Contract(tokenAAddress, erc20ABI, signer);
  const tokenBContract = new ethers.Contract(tokenBAddress, erc20ABI, signer);

  // Get token decimals
  const decimalsA = await tokenAContract.decimals();
  const decimalsB = await tokenBContract.decimals();
  console.log(`Token A decimals: ${decimalsA}, Token B decimals: ${decimalsB}`);

  // Amounts to deposit (in wei)
  const amountA = ethers.utils.parseUnits(amountOfTokenA, decimalsA);
  const amountB = ethers.utils.parseUnits(amountOfTokenB, decimalsB);

  // Exchange rates (10% gain and 10% loss, multiplied by 1e18 for precision)
  const rateAtoB = ethers.utils.parseUnits("1.1", 18);
  const rateBtoA = ethers.utils.parseUnits("0.9", 18);

  try {
    // Approve tokenA
    console.log('Approving Token A...');
    let tx = await tokenAContract.approve(dexAddress, amountA);
    await tx.wait();
    console.log('Token A approved');

    // Approve tokenB
    console.log('Approving Token B...');
    tx = await tokenBContract.approve(dexAddress, amountB);
    await tx.wait();
    console.log('Token B approved');

    // Add token pair with deposit
    console.log('Adding token pair and depositing...');
    tx = await dexContract.addTokenPairWithDeposit(
      tokenAAddress,
      tokenBAddress,
      rateAtoB,
      rateBtoA,
      amountA,
      amountB
    );
    await tx.wait();
    console.log('Token pair added and deposit made');

    // Check if the pair was actually added
    // const pairId = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(["address", "address"], [tokenAAddress, tokenBAddress]));
    // const pairInfo = await dexContract.tokenPairs(pairId);
    // console.log('Pair info:', pairInfo);

    // Preview swap (A to B)
    console.log('Previewing swap (A to B)...');
    const estimatedB = await dexContract.previewSwap(tokenAAddress, tokenBAddress, amountA);
    console.log(`Estimated amount of Token B for ${ethers.utils.formatUnits(amountA, decimalsA)} Token A: ${ethers.utils.formatUnits(estimatedB, decimalsB)}`);

    // Preview swap (B to A)
    console.log('Previewing swap (B to A)...');
    const estimatedA = await dexContract.previewSwap(tokenBAddress, tokenAAddress, amountB);
    console.log(`Estimated amount of Token A for ${ethers.utils.formatUnits(amountB, decimalsB)} Token B: ${ethers.utils.formatUnits(estimatedA, decimalsA)}`);

    // Check balances
    const balanceA = await dexContract.getBalance(tokenAAddress);
    const balanceB = await dexContract.getBalance(tokenBAddress);
    console.log(`DEX balance of Token A: ${ethers.utils.formatUnits(balanceA, decimalsA)}`);
    console.log(`DEX balance of Token B: ${ethers.utils.formatUnits(balanceB, decimalsB)}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

main();