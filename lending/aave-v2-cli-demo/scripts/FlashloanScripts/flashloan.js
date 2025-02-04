const ethers = require('ethers');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env file from the root directory
const rootDir = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(rootDir, '.env') });

// Read JSON files
const referencesPath = path.join(__dirname, '..', '..', 'api3-adaptors', 'references.json');
const liquidationReferencesPath = path.join(rootDir, 'api3-liquidations', 'liquidationReferences.json');

const references = JSON.parse(fs.readFileSync(referencesPath, 'utf8'));
const liquidationReferences = JSON.parse(fs.readFileSync(liquidationReferencesPath, 'utf8'));

// Contract addresses
const FlashLoanDex = liquidationReferences.FlashLoanDex;
const usdcAddress = references.USDCWithFaucet;
const api3Address = references.assets.find(asset => asset.assetSymbol === 'API3').ERC20;

// ABI for the FlashLoanLiquidationSwap contract
const flashLoanABI = [
    "function requestFlashLoan(address _flashAsset, uint256 _amount, address _tokenReceivedFromLiquidation) external",
    "function getBalance(address _tokenAddress) external view returns (uint256)",
    "function withdraw(address _tokenAddress) external"
];

// ABI for ERC20 tokens
const erc20ABI = [
    "function approve(address spender, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function transfer(address recipient, uint256 amount) returns (bool)"
];

async function main() {
    // Connect to the network
    const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL);
    const mnemonic = process.env.MNEMONIC;
    const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic);
    const wallet = new ethers.Wallet(hdNode.derivePath("m/44'/60'/0'/0/0")).connect(provider);

    // Create contract instances
    const flashLoanContract = new ethers.Contract(FlashLoanDex, flashLoanABI, wallet);
    const usdcContract = new ethers.Contract(usdcAddress, erc20ABI, wallet);
    const api3Contract = new ethers.Contract(api3Address, erc20ABI, wallet);

    // Get token decimals
    const usdcDecimals = await usdcContract.decimals();
    const api3Decimals = await api3Contract.decimals();
    console.log(`USDC decimals: ${usdcDecimals}, API3 decimals: ${api3Decimals}`);

    // Amount to borrow (e.g., 1000 USDC)
    const borrowAmount = ethers.utils.parseUnits("9000", usdcDecimals);

    // Amount of API3 to supply (should be equivalent to borrowed USDC plus some extra for fees)
    const api3Amount = ethers.utils.parseUnits("9000", api3Decimals); // Adjust this amount as needed

    try {
        // Supply API3 tokens to the flash loan contract
        console.log("Supplying API3 tokens to the flash loan contract...");
        await api3Contract.approve(FlashLoanDex, api3Amount);
        await api3Contract.transfer(FlashLoanDex, api3Amount);
        console.log("API3 tokens supplied");

        // Check balances before flash loan
        let usdcBalance = await usdcContract.balanceOf(FlashLoanDex);
        let api3Balance = await api3Contract.balanceOf(FlashLoanDex);
        console.log(`Before flash loan - USDC balance: ${ethers.utils.formatUnits(usdcBalance, usdcDecimals)}, API3 balance: ${ethers.utils.formatUnits(api3Balance, api3Decimals)}`);

        console.log(`Borrowing ${borrowAmount} USDC...`);
        // Request flash loan
        console.log("Requesting flash loan...");
        let tx = await flashLoanContract.requestFlashLoan(usdcAddress, borrowAmount, api3Address);
        await tx.wait();
        console.log("Flash loan executed");

        // Check balances after flash loan
        usdcBalance = await usdcContract.balanceOf(FlashLoanDex);
        api3Balance = await api3Contract.balanceOf(FlashLoanDex);
        console.log(`After flash loan - USDC balance: ${ethers.utils.formatUnits(usdcBalance, usdcDecimals)}, API3 balance: ${ethers.utils.formatUnits(api3Balance, api3Decimals)}`);

        // Withdraw any remaining tokens
        console.log("Withdrawing remaining tokens...");
        await flashLoanContract.withdraw(usdcAddress);
        await flashLoanContract.withdraw(api3Address);
        console.log("Tokens withdrawn");

        // Final balance check
        // usdcBalance = await usdcContract.balanceOf(wallet.address);
        // api3Balance = await api3Contract.balanceOf(wallet.address);
        // console.log(`Final balances - USDC: ${ethers.utils.formatUnits(usdcBalance, usdcDecimals)}, API3: ${ethers.utils.formatUnits(api3Balance, api3Decimals)}`);

    } catch (error) {
        console.error("Error:", error);
    }
}

main();