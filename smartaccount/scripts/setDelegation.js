require('dotenv').config();
const { ethers } = require('ethers');

async function main() {
    // Environment variables
    const PRIVATE_KEY = process.env.PRIVATE_KEY;
    const AI_AGENT_PUBLIC_ADDRESS = process.env.AI_AGENT_PUBLIC_ADDRESS;
    const RPC_URL = process.env.RPC_URL;
    const COLLATERAL_TOKEN = process.env.COLLATERAL_TOKEN;
    const DEBT_TOKEN = process.env.DEBT_TOKEN;
    const DEPLOYED_MULTISIG = process.env.DEPLOYED_MULTISIG;

    const COLLATERAL_DAILY_LIMIT = ethers.parseUnits("1000", 18);
    const DEBT_DAILY_LIMIT = ethers.parseUnits("1000", 6);

    // Validate environment variables
    if (!PRIVATE_KEY || !AI_AGENT_PUBLIC_ADDRESS || !RPC_URL || !COLLATERAL_TOKEN || !DEBT_TOKEN || !DEPLOYED_MULTISIG) {
        throw new Error('Missing required environment variables');
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    const MULTISIG_ABI = [
        "function submitDelegation(address token, address delegate, uint256 dailyLimit) external",
        "function confirmDelegation(address token, address delegate) external",
        "function getDelegationStatus(address token, address delegate) external view returns (uint256 dailyLimit, uint256 spentToday, uint256 remainingToday, uint256 timeUntilReset, uint256 confirmations, bool isActive)",
        "function isSigner(address) external view returns (bool)"
    ];

    const multiSig = new ethers.Contract(DEPLOYED_MULTISIG, MULTISIG_ABI, wallet);

    try {
        // Check if wallet is a signer
        console.log('Checking if wallet is a signer...');
        const isSigner = await multiSig.isSigner(wallet.address);
        if (!isSigner) {
            throw new Error(`Address ${wallet.address} is not a signer in the MultiSig contract`);
        }
        console.log('Wallet is confirmed as signer');

        async function setupDelegation(token, tokenName, dailyLimit) {
            console.log(`\nSetting up ${tokenName} delegation...`);
            
            // Submit new delegation
            console.log(`Submitting ${tokenName} delegation...`);
            const tx1 = await multiSig.submitDelegation(
                token,
                AI_AGENT_PUBLIC_ADDRESS,
                dailyLimit
            );
            await tx1.wait(2);
            console.log(`${tokenName} delegation submitted. Hash:`, tx1.hash);

            // Confirm immediately
            console.log(`Confirming ${tokenName} delegation...`);
            const tx2 = await multiSig.confirmDelegation(
                token,
                AI_AGENT_PUBLIC_ADDRESS
            );
            await tx2.wait(2);
            console.log(`${tokenName} delegation confirmed. Hash:`, tx2.hash);

            // Check final status
            const status = await multiSig.getDelegationStatus(token, AI_AGENT_PUBLIC_ADDRESS);
            console.log(`${tokenName} final status:`, status);
        }

        // Setup both tokens
        await setupDelegation(COLLATERAL_TOKEN, "Collateral Token", COLLATERAL_DAILY_LIMIT);
        await setupDelegation(DEBT_TOKEN, "Debt Token", DEBT_DAILY_LIMIT);

        console.log('\nDelegation setup completed');

    } catch (error) {
        console.error('Error:', error.message);
        if (error.transaction) {
            console.error('Failed transaction:', error.transaction);
        }
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });