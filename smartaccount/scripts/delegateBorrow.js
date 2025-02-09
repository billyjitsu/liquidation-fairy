const ethers = require('ethers');
require('dotenv').config();

const DEBT_TOKEN_ABI = [
    'function borrowAllowance(address fromUser, address toUser) external view returns (uint256)',
    'function approveDelegation(address delegatee, uint256 amount) external',
    'function decimals() external view returns (uint8)'
];

const MULTISIG_ABI = [
    "function submitTransaction(address to, uint256 value, bytes memory data) public",
    "function executeTransaction(uint256 txIndex) public",
    "function getTransactionCount() public view returns (uint256)"
];

async function setupCreditDelegation() {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

        console.log('MultiSig Owner Address:', wallet.address);
        console.log('MultiSig Address:', process.env.DEPLOYED_MULTISIG);
        console.log('AI Agent Address:', process.env.AI_AGENT_PUBLIC_ADDRESS);

        // Contract instances
        const multisig = new ethers.Contract(
            process.env.DEPLOYED_MULTISIG,
            MULTISIG_ABI,
            wallet
        );

        const debtToken = new ethers.Contract(
            process.env.VARIABLE_DEBT_TOKEN,
            DEBT_TOKEN_ABI,
            wallet
        );

        // Check current allowance
        const currentAllowance = await debtToken.borrowAllowance(
            process.env.DEPLOYED_MULTISIG,
            process.env.AI_AGENT_PUBLIC_ADDRESS
        );
        
        const decimals = await debtToken.decimals();
        console.log('Current Delegation Allowance:', ethers.formatUnits(currentAllowance, decimals));

        // Set delegation amount (e.g., 1000 USDC)
        const delegationAmount = ethers.parseUnits("1000", decimals);
        console.log('Setting Delegation Amount:', ethers.formatUnits(delegationAmount, decimals));

        // Encode the approveDelegation function call
        const delegationData = debtToken.interface.encodeFunctionData(
            'approveDelegation',
            [process.env.AI_AGENT_PUBLIC_ADDRESS, delegationAmount]
        );

        // Submit transaction to MultiSig
        console.log('Submitting delegation transaction to MultiSig...');
        const submitTx = await multisig.submitTransaction(
            process.env.VARIABLE_DEBT_TOKEN,
            BigInt(0),
            delegationData
        );
        await submitTx.wait();
        console.log('Delegation transaction submitted:', submitTx.hash);

        // Get transaction index
        const txCount = await multisig.getTransactionCount();
        const txIndex = txCount.toString() - 1;

        // Execute transaction
        console.log('Executing delegation transaction...');
        const executeTx = await multisig.executeTransaction(txIndex);
        await executeTx.wait();
        console.log('Delegation transaction executed:', executeTx.hash);

        // Verify new allowance
        const newAllowance = await debtToken.borrowAllowance(
            process.env.DEPLOYED_MULTISIG,
            process.env.AI_AGENT_PUBLIC_ADDRESS
        );
        console.log('New Delegation Allowance:', ethers.formatUnits(newAllowance, decimals));

    } catch (error) {
        console.error('Error setting up credit delegation:', error);
        if (error.error) {
            console.error('Detailed error:', error.error);
        }
        throw error;
    }
}

// Execute the setup
setupCreditDelegation()
    .then(() => {
        console.log('Credit delegation setup completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('Unhandled error in delegation setup:', error);
        process.exit(1);
    });