const ethers = require('ethers');
require('dotenv').config();

const LENDING_POOL_ABI = [
    'function withdraw(address asset, uint256 amount, address to) external returns (uint256)',
    'function getUserAccountData(address user) public view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)'
];

const MULTISIG_ABI = [
    "function submitTransaction(address to, uint256 value, bytes memory data) public",
    "function executeTransaction(uint256 txIndex) public",
    "function getTransaction(uint256 txIndex) public view returns (address to, uint256 value, bytes memory data, bool executed, uint256 numConfirmations)",
    "function getTransactionCount() public view returns (uint256)"
];

async function withdrawFromLendingPoolViaMultisig() {
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    // Contract instances
    const multisig = new ethers.Contract(
        process.env.DEPLOYED_MULTISIG,
        MULTISIG_ABI,
        wallet
    );

    const lendingPool = new ethers.Contract(
        process.env.LENDING_POOL_ADDRESS,
        LENDING_POOL_ABI,
        wallet
    );

    const withdrawAmount = ethers.parseUnits("50", 18); 

    try {
        // Check account data before withdrawal
        console.log('Account data before withdrawal:');
        await checkAccountData(lendingPool, process.env.DEPLOYED_MULTISIG);

        // Create withdrawal transaction
        console.log('Submitting withdrawal transaction to MultiSig...');
        const withdrawData = lendingPool.interface.encodeFunctionData(
            'withdraw',
            [
                process.env.COLLATERAL_TOKEN,
                withdrawAmount,
                process.env.DEPLOYED_MULTISIG // Withdrawing back to the MultiSig
            ]
        );

        const submitWithdrawTx = await multisig.submitTransaction(
            process.env.LENDING_POOL_ADDRESS,
            BigInt(0),
            withdrawData
        );
        await submitWithdrawTx.wait();
        console.log('Withdrawal transaction submitted to MultiSig:', submitWithdrawTx.hash);

        // Get the transaction index for the withdrawal
        const txCount = await multisig.getTransactionCount();
        const withdrawTxIndex = txCount.toString() - 1;
        
        // Execute withdrawal transaction
        console.log('Executing withdrawal transaction...');
        const executeWithdrawTx = await multisig.executeTransaction(withdrawTxIndex);
        await executeWithdrawTx.wait();
        console.log('Withdrawal transaction executed:', executeWithdrawTx.hash);

        // Check account data after withdrawal
        console.log('Account data after withdrawal:');
        await checkAccountData(lendingPool, process.env.DEPLOYED_MULTISIG);

    } catch (error) {
        console.error('Error during multisig withdrawal:', error);
        if (error.error) {
            console.error('Detailed error:', error.error);
        }
        throw error;
    }
}

async function checkAccountData(lendingPool, userAddress) {
    try {
        const accountData = await lendingPool.getUserAccountData(userAddress);
        console.log('Account Data:');
        console.log('Total Collateral (ETH):', ethers.formatEther(accountData.totalCollateralETH));
        console.log('Total Debt (ETH):', ethers.formatEther(accountData.totalDebtETH));
        console.log('Available Borrows (ETH):', ethers.formatEther(accountData.availableBorrowsETH));
        console.log('Current Liquidation Threshold:', accountData.currentLiquidationThreshold.toString());
        console.log('LTV:', accountData.ltv.toString());
        console.log('Health Factor:', ethers.formatEther(accountData.healthFactor));
    } catch (error) {
        console.error('Error checking account data:', error);
    }
}

// Execute the withdrawal
withdrawFromLendingPoolViaMultisig()
    .then(() => {
        console.log('All operations completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('Unhandled error in main execution:', error);
        process.exit(1);
    });