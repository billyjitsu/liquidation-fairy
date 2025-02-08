const ethers = require('ethers');
require('dotenv').config();

const MULTISIG_ABI = [
    "function delegatedTransfer(address _token, address _to, uint256 _amount) public returns (bool)",
    "function getDelegationStatus(address _token, address _delegate) public view returns (uint256 dailyLimit, uint256 spentToday, uint256 remainingToday, uint256 timeUntilReset, uint256 confirmations, bool isActive)"
];

const ERC20_ABI = [
    "function balanceOf(address account) public view returns (uint256)"
];

async function withdrawTokens() {
    // Setup provider and wallet using AI agent's key
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.AI_AGENT_PRIVATE_KEY, provider);

    // Contract instances
    const multisig = new ethers.Contract(process.env.DEPLOYED_MULTISIG, MULTISIG_ABI, wallet);
    const collateralToken = new ethers.Contract(process.env.COLLATERAL_TOKEN, ERC20_ABI, provider);
    const debtToken = new ethers.Contract(process.env.DEBT_TOKEN, ERC20_ABI, provider);

    try {
        // Check delegation status for both tokens
        console.log('Checking delegation status...');
        
        const [collateralStatus, debtStatus] = await Promise.all([
            multisig.getDelegationStatus(process.env.COLLATERAL_TOKEN, wallet.address),
            multisig.getDelegationStatus(process.env.DEBT_TOKEN, wallet.address)
        ]);

        console.log('Collateral Delegation Status:', collateralStatus);
        console.log('Debt Delegation Status:', debtStatus);

        if (!collateralStatus[5] || !debtStatus[5]) {
            throw new Error('Delegations not active for one or both tokens');
        }

        // Get available amounts within daily limits
        const collateralAvailable = collateralStatus[2]; // remainingToday
        const debtAvailable = debtStatus[2]; // remainingToday

        console.log(`Available to withdraw: ${ethers.formatUnits(collateralAvailable, 18)} Collateral Token`);
        console.log(`Available to withdraw: ${ethers.formatUnits(debtAvailable, 6)} Debt Token`);

        // Check multisig balances
        const [collateralBalance, debtBalance] = await Promise.all([
            collateralToken.balanceOf(process.env.DEPLOYED_MULTISIG),
            debtToken.balanceOf(process.env.DEPLOYED_MULTISIG)
        ]);

        // Calculate withdrawal amounts (use the minimum of available limit and balance)
        const collateralAmount = collateralBalance < collateralAvailable ? 
            collateralBalance : collateralAvailable;
        const debtAmount = debtBalance < debtAvailable ? 
            debtBalance : debtAvailable;

        if (collateralAmount > 0) {
            console.log(`Withdrawing ${ethers.formatUnits(collateralAmount, 18)} Collateral Token...`);
            const tx1 = await multisig.delegatedTransfer(
                process.env.COLLATERAL_TOKEN,
                wallet.address,
                collateralAmount,
                { gasLimit: 300000 }
            );
            await tx1.wait();
            console.log('Collateral Token withdrawal complete:', tx1.hash);
        }

        if (debtAmount > 0) {
            console.log(`Withdrawing ${ethers.formatUnits(debtAmount, 6)} Debt Token...`);
            const tx2 = await multisig.delegatedTransfer(
                process.env.DEBT_TOKEN,
                wallet.address,
                debtAmount,
                { gasLimit: 300000 }
            );
            await tx2.wait();
            console.log('Debt Token withdrawal complete:', tx2.hash);
        }

        // Final balance check
        const [finalCollateralBalance, finalDebtBalance] = await Promise.all([
            collateralToken.balanceOf(wallet.address),
            debtToken.balanceOf(wallet.address)
        ]);

        console.log('\nFinal Balances:');
        console.log(`Collateral Token: ${ethers.formatUnits(finalCollateralBalance, 18)}`);
        console.log(`Debt Token: ${ethers.formatUnits(finalDebtBalance, 6)}`);

    } catch (error) {
        console.error('Error during withdrawal:', error.message);
        throw error;
    }
}

// Execute the script
withdrawTokens()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });