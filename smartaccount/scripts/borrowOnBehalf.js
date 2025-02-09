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
    'function getAssetPrice(address asset) external view returns (uint256)'
];

const PROTOCOL_DATA_PROVIDER_ABI = [
    'function getUserReserveData(address asset, address user) external view returns (uint256 currentATokenBalance, uint256 currentStableDebt, uint256 currentVariableDebt, uint256 principalStableDebt, uint256 scaledVariableDebt, uint256 stableBorrowRate, uint256 liquidityRate, uint40 stableRateLastUpdated, bool usageAsCollateralEnabled)'
];

const DEBT_TOKEN_ABI = [
    'function borrowAllowance(address fromUser, address toUser) external view returns (uint256)',
    'function decimals() external view returns (uint8)'
];

async function getAssetPrice(aaveOracle, assetAddress) {
    const assetPrice = await aaveOracle.getAssetPrice(assetAddress);
    return assetPrice;
}

async function borrowUSDCFromLendingPool() {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        const aiWallet = new ethers.Wallet(process.env.AI_AGENT_PRIVATE_KEY, provider);

        console.log('AI Agent Address:', aiWallet.address);
        console.log('Borrowing on behalf of MultiSig:', process.env.DEPLOYED_MULTISIG);

        // Check delegation allowance first
        const debtToken = new ethers.Contract(
            process.env.VARIABLE_DEBT_TOKEN,
            DEBT_TOKEN_ABI,
            provider
        );

        const borrowAllowance = await debtToken.borrowAllowance(
            process.env.DEPLOYED_MULTISIG,
            aiWallet.address
        );

        const debtDecimals = await debtToken.decimals();
        console.log('Current borrow allowance:', ethers.formatUnits(borrowAllowance, debtDecimals), 'USDC');

        if (borrowAllowance.toString() === '0') {
            console.error('\nError: No borrowing allowance');
            console.error('The AI agent does not have permission to borrow on behalf of the MultiSig');
            console.error('Please run the credit delegation setup script first');
            process.exit(1);
        }

        // Initialize contracts with AI wallet
        const collateralToken = new ethers.Contract(
            process.env.COLLATERAL_TOKEN,
            ERC20_ABI,
            aiWallet
        );

        const lendingPool = new ethers.Contract(
            process.env.LENDING_POOL_ADDRESS,
            LENDING_POOL_ABI,
            aiWallet
        );

        const aaveOracle = new ethers.Contract(
            process.env.AAVE_ORACLE_ADDRESS,
            AAVE_ORACLE_ABI,
            aiWallet
        );

        const protocolDataProvider = new ethers.Contract(
            process.env.PROTOCOL_DATA_PROVIDER_ADDRESS,
            PROTOCOL_DATA_PROVIDER_ABI,
            aiWallet
        );

        // Get ETH price
        const ethPrice = await getAssetPrice(aaveOracle, process.env.WETH_TOKEN_ADDRESS);
        console.log('ETH Price (in USD):', ethers.formatUnits(ethPrice, 8));

        // Get collateral price
        const collateralPrice = await getAssetPrice(aaveOracle, process.env.COLLATERAL_TOKEN);
        console.log('Collateral Price (in USD):', ethers.formatUnits(collateralPrice, 8));

        // Get deposited collateral balance for MultiSig
        const userReserveData = await protocolDataProvider.getUserReserveData(
            process.env.COLLATERAL_TOKEN,
            process.env.DEPLOYED_MULTISIG
        );
        const depositedCollateralBalance = userReserveData.currentATokenBalance;
        const collateralDecimals = await collateralToken.decimals();
        console.log('MultiSig Deposited Collateral Balance:', ethers.formatUnits(depositedCollateralBalance, collateralDecimals));

        // Calculate collateral value in USD
        const depositedBalanceBigInt = BigInt(depositedCollateralBalance.toString());
        const collateralPriceBigInt = BigInt(collateralPrice.toString());
        const decimalsBigInt = 10n ** BigInt(collateralDecimals.toString());
        
        const collateralValueInUsd = (depositedBalanceBigInt * collateralPriceBigInt) / decimalsBigInt;
        const totalCollateralUSD = Number(ethers.formatUnits(collateralValueInUsd, 8));
        console.log('Total Collateral USD:', totalCollateralUSD.toFixed(2));

        // Get MultiSig's account data
        const accountData = await lendingPool.getUserAccountData(process.env.DEPLOYED_MULTISIG);
        
        // Get user's debt data
        const debtData = await protocolDataProvider.getUserReserveData(
            process.env.DEBT_TOKEN,
            process.env.DEPLOYED_MULTISIG
        );
        
        const totalVariableDebt = Number(ethers.formatUnits(debtData.currentVariableDebt, debtDecimals));
        const totalStableDebt = Number(ethers.formatUnits(debtData.currentStableDebt, debtDecimals));
        const totalDebtUSD = totalVariableDebt + totalStableDebt;

        // Calculate LTV percentage
        const ltvPercentage = Number(accountData.ltv) / 100;
        console.log('LTV:', `${ltvPercentage}%`);

        console.log(`Current Variable Debt: ${totalVariableDebt.toFixed(2)} USDC`);
        console.log(`Current Stable Debt: ${totalStableDebt.toFixed(2)} USDC`);
        console.log('Total Debt USD:', totalDebtUSD.toFixed(2));

        // Calculate available borrows
        const availableBorrowsUSD = totalCollateralUSD * (ltvPercentage / 100) - totalDebtUSD;
        console.log('Available Borrows USD:', availableBorrowsUSD.toFixed(2));

        // Get debt token price
        const debtTokenPrice = await getAssetPrice(aaveOracle, process.env.DEBT_TOKEN);
        console.log('Debt Token Price (in USD):', ethers.formatUnits(debtTokenPrice, 8));

        // Calculate maximum borrow amount
        const maxBorrowUSDC = Math.min(
            availableBorrowsUSD,
            Number(ethers.formatUnits(borrowAllowance, debtDecimals))
        );
        console.log('Maximum Borrowable (USDC):', maxBorrowUSDC.toFixed(6));

        // Set borrow amount to desired percentage of maximum
        const borrowPercentage = 100;
        const borrowAmount = Math.floor(maxBorrowUSDC * borrowPercentage / 100);
        console.log('Attempting to borrow:', borrowAmount.toFixed(6), 'USDC');

        if (borrowAmount <= 0) {
            console.log('Cannot borrow: Amount is zero or negative');
            return;
        }

        // Convert to Wei (6 decimals for USDC)
        const borrowAmountWei = ethers.parseUnits(borrowAmount.toFixed(6), 6);
        console.log('Borrow Amount (Wei):', borrowAmountWei.toString());

        // Check against delegation allowance
        if (borrowAmountWei > borrowAllowance) {
            console.error('\nError: Borrow amount exceeds delegation allowance');
            console.error('Attempting to borrow:', ethers.formatUnits(borrowAmountWei, debtDecimals), 'USDC');
            console.error('Allowance:', ethers.formatUnits(borrowAllowance, debtDecimals), 'USDC');
            process.exit(1);
        }

        const VARIABLE_RATE_MODE = 2;
        const referralCode = 0;

        // Estimate gas
        const estimatedGas = await lendingPool.borrow.estimateGas(
            process.env.DEBT_TOKEN,
            borrowAmountWei,
            VARIABLE_RATE_MODE,
            referralCode,
            process.env.DEPLOYED_MULTISIG
        );

        console.log('Estimated gas:', estimatedGas.toString());

        // Add 20% buffer to gas estimate
        const gasLimit = estimatedGas * BigInt(120) / BigInt(100);
        console.log('Gas limit with buffer:', gasLimit.toString());

        console.log('Executing borrow transaction...');
        const borrowTx = await lendingPool.borrow(
            process.env.DEBT_TOKEN,
            borrowAmountWei,
            VARIABLE_RATE_MODE,
            referralCode,
            process.env.DEPLOYED_MULTISIG,
            {
                gasLimit: gasLimit
            }
        );

        console.log('Borrow transaction sent. Waiting for confirmation...');
        const receipt = await borrowTx.wait();
        
        if (receipt.status === 1) {
            console.log('Borrow transaction completed successfully');
            console.log('Transaction hash:', receipt.hash);
        } else {
            console.log('Borrow transaction failed');
        }

        // Create new contract instance for checking balance using ERC20 ABI
        const debtTokenERC20 = new ethers.Contract(
            process.env.DEBT_TOKEN,
            ERC20_ABI,
            provider
        );
        
        const balance = await debtTokenERC20.balanceOf(process.env.DEPLOYED_MULTISIG);
        console.log('MultiSig Debt Token Balance after borrowing:', ethers.formatUnits(balance, debtDecimals));

        // Check final health factor
        const finalAccountData = await lendingPool.getUserAccountData(process.env.DEPLOYED_MULTISIG);
        console.log('Health Factor:', ethers.formatEther(finalAccountData.healthFactor));

    } catch (error) {
        console.error('Error during borrow:', error);
        if (error.error) {
            console.error('Detailed error:', error.error);
        }
        if (error.transaction) {
            console.error('Transaction details:', error.transaction);
        }
        throw error;
    }
}

// Execute the borrow
borrowUSDCFromLendingPool()
    .then(() => {
        console.log('All operations completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('Unhandled error in main execution:', error);
        process.exit(1);
    });