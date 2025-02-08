const ethers = require('ethers');
require('dotenv').config();

const collateralAmount = ethers.parseUnits("100.0", 18); 
const debtAmount = ethers.parseUnits("100.0", 6); 

const ERC20_ABI = [
    "function transfer(address to, uint256 amount) public returns (bool)",
    "function balanceOf(address account) public view returns (uint256)",
    "function approve(address spender, uint256 amount) public returns (bool)"
];

async function transferTokens() {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    const collateralToken = new ethers.Contract(process.env.COLLATERAL_TOKEN, ERC20_ABI, wallet);
    const debtToken = new ethers.Contract(process.env.DEBT_TOKEN, ERC20_ABI, wallet);
    const multisigAddress = process.env.DEPLOYED_MULTISIG;

    try {
        // Transfer collateral token
        console.log("Transferring collateral tokens...");
        const collateralTx = await collateralToken.transfer(multisigAddress, collateralAmount);
        await collateralTx.wait();
        console.log("Collateral token transfer complete:", collateralTx.hash);

        // Transfer debt token (USDC)
        console.log("Transferring debt tokens...");
        const debtTx = await debtToken.transfer(multisigAddress, debtAmount);
        await debtTx.wait();
        console.log("Debt token transfer complete:", debtTx.hash);

    } catch (error) {
        console.error("Error during transfer:", error);
    }
}

transferTokens()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });