const ethers = require('ethers');
require('dotenv').config();

const ERC20_ABI = [
    'function balanceOf(address account) public view returns (uint256)',
    'function decimals() public view returns (uint8)',
    'function approve(address spender, uint256 amount) public returns (bool)'
];

const LENDING_POOL_ABI = [
    'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) public',
    'function getUserAccountData(address user) public view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)'
];

const AAVE_ORACLE_ABI = [
    'function getAssetPrice(address asset) external view returns (uint256)',
    'function getSourceOfAsset(address asset) external view returns (address)'
];

const PROTOCOL_DATA_PROVIDER_ABI = [
    'function getUserReserveData(address asset, address user) external view returns (uint256 currentATokenBalance, uint256 currentStableDebt, uint256 currentVariableDebt, uint256 principalStableDebt, uint256 scaledVariableDebt, uint256 stableBorrowRate, uint256 liquidityRate, uint40 stableRateLastUpdated, bool usageAsCollateralEnabled)'
];

const MULTISIG_ABI = [
    "function submitTransaction(address to, uint256 value, bytes memory data) public",
    "function executeTransaction(uint256 txIndex) public",
    "function getTransaction(uint256 txIndex) public view returns (address to, uint256 value, bytes memory data, bool executed, uint256 numConfirmations)",
    "function getTransactionCount() public view returns (uint256)"
];

async function getAssetPrice(aaveOracle, assetAddress) {
    const assetPrice = await aaveOracle.getAssetPrice(assetAddress);
    return assetPrice;
}

async function borrowViaMultisig() {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

        // Contract instances
        const multisig = new ethers.Contract(
            process.env.DEPLOYED_MULTISIG,
            MULTISIG_ABI,
            wallet
        );

        const debtToken = new ethers.Contract(
            process.env.DEBT_TOKEN,
            ERC20_ABI,
            wallet
        );

        const lendingPool = new ethers.Contract(
            process.env.LENDING_POOL_ADDRESS,
            LENDING_POOL_ABI,
            wallet
        );

        const aaveOracle = new ethers.Contract(
            process.env.AAVE_ORACLE_ADDRESS,
            AAVE_ORACLE_ABI,
            wallet
        );

        const protocolDataProvider = new ethers.Contract(
            process.env.PROTOCOL_DATA_PROVIDER_ADDRESS,
            PROTOCOL_DATA_PROVIDER_ABI,
            wallet
        );

        // Constants
        const referralCode = 0;
        const VARIABLE_RATE_MODE = 2;

        // Calculate borrow amount using the same logic as before
        const ethPrice = await getAssetPrice(aaveOracle, process.env.WETH_TOKEN_ADDRESS);
        console.log('ETH Price (in USD):', ethers.formatUnits(ethPrice, 8));

        // Get user's account data (for the MultiSig)
        const accountData = await lendingPool.getUserAccountData(process.env.DEPLOYED_MULTISIG);
        console.log('MultiSig Available Borrows (ETH):', ethers.formatEther(accountData.availableBorrowsETH));
        
        // Get debt token price
        const debtTokenPrice = await getAssetPrice(aaveOracle, process.env.DEBT_TOKEN);
        console.log('Debt Token Price (in USD):', ethers.formatUnits(debtTokenPrice, 8));

        // Calculate borrow amount in USDC
        const availableBorrowsETH = Number(ethers.formatEther(accountData.availableBorrowsETH));
        const ethPriceNumber = Number(ethers.formatUnits(ethPrice, 8));
        const availableBorrowsUSD = availableBorrowsETH * ethPriceNumber;

        // Set borrow amount to 80% of maximum
        const borrowPercentage = 100;
        const borrowAmount = Math.floor(availableBorrowsUSD * borrowPercentage / 100);
        console.log('Attempting to borrow:', borrowAmount.toFixed(6), 'USDC');

        if (borrowAmount <= 0) {
            console.log('Cannot borrow: Amount is zero or negative');
            return;
        }

        // Convert to Wei (6 decimals for USDC)
        const borrowAmountWei = ethers.parseUnits(borrowAmount.toFixed(6), 6);
        console.log('Borrow Amount (Wei):', borrowAmountWei.toString());

        // Step 1: Submit borrow transaction to MultiSig
        console.log('Submitting borrow transaction to MultiSig...');
        const borrowData = lendingPool.interface.encodeFunctionData(
            'borrow',
            [
                process.env.DEBT_TOKEN,
                borrowAmountWei,
                VARIABLE_RATE_MODE,
                referralCode,
                process.env.DEPLOYED_MULTISIG // onBehalfOf is the MultiSig
            ]
        );

        const submitBorrowTx = await multisig.submitTransaction(
            process.env.LENDING_POOL_ADDRESS,
            BigInt(0),
            borrowData
        );
        await submitBorrowTx.wait();
        console.log('Borrow transaction submitted to MultiSig:', submitBorrowTx.hash);

        // Get the transaction index for the borrow
        const txCount = await multisig.getTransactionCount();
        const borrowTxIndex = txCount.toString() - 1;
        
        // Execute borrow transaction
        console.log('Executing borrow transaction...');
        const executeBorrowTx = await multisig.executeTransaction(borrowTxIndex);
        await executeBorrowTx.wait();
        console.log('Borrow transaction executed:', executeBorrowTx.hash);

        // Check final balances and health factor
        const balance = await debtToken.balanceOf(process.env.DEPLOYED_MULTISIG);
        console.log('MultiSig Debt Token Balance after borrowing:', ethers.formatUnits(balance, 6));

        await checkAccountData(lendingPool, process.env.DEPLOYED_MULTISIG);

    } catch (error) {
        console.error('Error during multisig borrow:', error);
        if (error.error) {
            console.error('Detailed error:', error.error);
        }
        if (error.transaction) {
            console.error('Transaction details:', error.transaction);
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

// Execute the borrow
borrowViaMultisig()
    .then(() => {
        console.log('All operations completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('Unhandled error in main execution:', error);
        process.exit(1);
    });