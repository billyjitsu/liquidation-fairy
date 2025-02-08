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

async function getAssetPrice(aaveOracle, assetAddress) {
    const assetPrice = await aaveOracle.getAssetPrice(assetAddress);
    return assetPrice;
}

async function borrowUSDCFromLendingPool() {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

        const debtToken = new ethers.Contract(process.env.DEBT_TOKEN, ERC20_ABI, wallet);
        const collateralToken = new ethers.Contract(process.env.COLLATERAL_TOKEN, ERC20_ABI, wallet);
        const lendingPool = new ethers.Contract(process.env.LENDING_POOL_ADDRESS, LENDING_POOL_ABI, wallet);
        const aaveOracle = new ethers.Contract(process.env.AAVE_ORACLE_ADDRESS, AAVE_ORACLE_ABI, wallet);
        const protocolDataProvider = new ethers.Contract(process.env.PROTOCOL_DATA_PROVIDER_ADDRESS, PROTOCOL_DATA_PROVIDER_ABI, wallet);

        const referralCode = 0;
        const VARIABLE_RATE_MODE = 2;

        // Get ETH price
        const ethPrice = await getAssetPrice(aaveOracle, process.env.WETH_TOKEN_ADDRESS);
        console.log('ETH Price (in USD):', ethers.formatUnits(ethPrice, 8));

        // Get collateral price
        const collateralPrice = await getAssetPrice(aaveOracle, process.env.COLLATERAL_TOKEN);
        console.log('Collateral Price (in USD):', ethers.formatUnits(collateralPrice, 8));

        // Get deposited collateral balance
        const userReserveData = await protocolDataProvider.getUserReserveData(
            process.env.COLLATERAL_TOKEN,
            wallet.address
        );
        const depositedCollateralBalance = userReserveData.currentATokenBalance;
        const collateralDecimals = await collateralToken.decimals();
        console.log('Deposited Collateral Balance:', ethers.formatUnits(depositedCollateralBalance, collateralDecimals));

        // Calculate collateral value in USD using BigInt operations
        const PRICE_DECIMALS = 8n;
        const SCALE = 10n ** PRICE_DECIMALS;
        
        const depositedBalanceBigInt = BigInt(depositedCollateralBalance.toString());
        const collateralPriceBigInt = BigInt(collateralPrice.toString());
        const decimalsBigInt = 10n ** BigInt(collateralDecimals.toString());
        
        // Calculate USD value: (balance * price) / (10 ** decimals)
        const collateralValueInUsd = (depositedBalanceBigInt * collateralPriceBigInt) / decimalsBigInt;
        const totalCollateralUSD = Number(ethers.formatUnits(collateralValueInUsd, Number(PRICE_DECIMALS)));
        console.log('Total Collateral USD:', totalCollateralUSD.toFixed(2));

        // Get user's account data
        const accountData = await lendingPool.getUserAccountData(wallet.address);
        
        // Calculate total debt in USD
        const totalDebtETH = Number(ethers.formatEther(accountData.totalDebtETH));
        const ethPriceNumber = Number(ethers.formatUnits(ethPrice, 8));
        const totalDebtUSD = totalDebtETH * ethPriceNumber;
        console.log('Total Debt USD:', totalDebtUSD.toFixed(2));

        // Calculate LTV percentage
        const ltvPercentage = Number(accountData.ltv) / 100;
        console.log('LTV:', `${ltvPercentage}%`);

        // Calculate available borrows
        const availableBorrowsUSD = totalCollateralUSD * (ltvPercentage / 100) - totalDebtUSD;
        console.log('Available Borrows USD:', availableBorrowsUSD.toFixed(2));

        // Get debt token price
        const debtTokenPrice = await getAssetPrice(aaveOracle, process.env.DEBT_TOKEN);
        console.log('Debt Token Price (in USD):', ethers.formatUnits(debtTokenPrice, 8));

        // Calculate maximum borrow amount
        const maxBorrowUSDC = availableBorrowsUSD;
        console.log('Maximum Borrowable (USDC):', maxBorrowUSDC.toFixed(6));

        // Set borrow amount to 80% of maximum
        const borrowPercentage = 100;
        const borrowAmount = Math.floor(maxBorrowUSDC * borrowPercentage / 100);
        console.log('Attempting to borrow:', borrowAmount.toFixed(6), 'USDC');

        if (borrowAmount <= 0) {
            console.log('Cannot borrow: Borrow amount is zero or negative');
            return;
        }

        // Convert to Wei (6 decimals for USDC)
        const borrowAmountWei = ethers.parseUnits(borrowAmount.toFixed(6), 6);
        console.log('Borrow Amount (Wei):', borrowAmountWei.toString());

        // Estimate gas
        const estimatedGas = await lendingPool.borrow.estimateGas(
            process.env.DEBT_TOKEN,
            borrowAmountWei,
            VARIABLE_RATE_MODE,
            referralCode,
            wallet.address
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
            wallet.address,
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

        // Check final balance
        const balance = await debtToken.balanceOf(wallet.address);
        console.log('Debt Token Balance after borrowing:', ethers.formatUnits(balance, 6));

        // Check final health factor
        const finalAccountData = await lendingPool.getUserAccountData(wallet.address);
        console.log('Health Factor:', ethers.formatEther(finalAccountData.healthFactor));

    } catch (error) {
        console.error('Error:', error);
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