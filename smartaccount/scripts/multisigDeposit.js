const ethers = require('ethers');
require('dotenv').config();

const LENDING_POOL_ABI = [
    'function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) public',
    'function getUserAccountData(address user) public view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)'
];

const ERC20_ABI = [
    "function transfer(address to, uint256 amount) public returns (bool)",
    "function balanceOf(address account) public view returns (uint256)",
    "function approve(address spender, uint256 amount) public returns (bool)"
];

const MULTISIG_ABI = [
    "function submitTransaction(address to, uint256 value, bytes memory data) public",
    "function executeTransaction(uint256 txIndex) public",
    "function getTransaction(uint256 txIndex) public view returns (address to, uint256 value, bytes memory data, bool executed, uint256 numConfirmations)",
    "function getTransactionCount() public view returns (uint256)"
];

async function depositToLendingPoolViaMultisig() {
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    // Contract instances
    const multisig = new ethers.Contract(
        process.env.DEPLOYED_MULTISIG,
        MULTISIG_ABI,
        wallet
    );
    
    const collateralToken = new ethers.Contract(
        process.env.COLLATERAL_TOKEN,
        ERC20_ABI,
        wallet
    );

    const lendingPool = new ethers.Contract(
        process.env.LENDING_POOL_ADDRESS,
        LENDING_POOL_ABI,
        wallet
    );

    const depositAmount = ethers.parseUnits("100", 18); // Adjust amount as needed
    const referralCode = 0;

    try {
        // Check multisig's token balance
        const balance = await collateralToken.balanceOf(process.env.DEPLOYED_MULTISIG);
        console.log('MultiSig Token Balance:', ethers.formatUnits(balance, 18));

        // Step 1: Create approval transaction
        console.log('Submitting approval transaction to MultiSig...');
        const approvalData = collateralToken.interface.encodeFunctionData(
            'approve',
            [process.env.LENDING_POOL_ADDRESS, depositAmount]
        );
        
        const submitApproveTx = await multisig.submitTransaction(
            process.env.COLLATERAL_TOKEN,
            BigInt(0),
            approvalData
        );
        await submitApproveTx.wait();
        console.log('Approval transaction submitted to MultiSig:', submitApproveTx.hash);

        // Get the transaction index for the approval
        const txCount = await multisig.getTransactionCount();
        const approvalTxIndex = txCount.toString() - 1;
        
        // Execute approval transaction (since you're the only signer)
        console.log('Executing approval transaction...');
        const executeApproveTx = await multisig.executeTransaction(approvalTxIndex);
        await executeApproveTx.wait();
        console.log('Approval transaction executed:', executeApproveTx.hash);

        // Step 2: Create deposit transaction
        console.log('Submitting deposit transaction to MultiSig...');
        const depositData = lendingPool.interface.encodeFunctionData(
            'deposit',
            [
                process.env.COLLATERAL_TOKEN,
                depositAmount,
                process.env.DEPLOYED_MULTISIG, // onBehalfOf is the MultiSig
                referralCode
            ]
        );

        const submitDepositTx = await multisig.submitTransaction(
            process.env.LENDING_POOL_ADDRESS,
            BigInt(0),
            depositData
        );
        await submitDepositTx.wait();
        console.log('Deposit transaction submitted to MultiSig:', submitDepositTx.hash);

        // Get the transaction index for the deposit
        const newTxCount = await multisig.getTransactionCount();
        const depositTxIndex = newTxCount.toString() - 1;
        
        // Execute deposit transaction
        console.log('Executing deposit transaction...');
        const executeDepositTx = await multisig.executeTransaction(depositTxIndex);
        await executeDepositTx.wait();
        console.log('Deposit transaction executed:', executeDepositTx.hash);

        // Check account data after deposit
        await checkAccountData(lendingPool, process.env.DEPLOYED_MULTISIG);

    } catch (error) {
        console.error('Error during multisig deposit:', error);
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

// Execute the deposit
depositToLendingPoolViaMultisig()
    .then(() => {
        console.log('All operations completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('Unhandled error in main execution:', error);
        process.exit(1);
    });