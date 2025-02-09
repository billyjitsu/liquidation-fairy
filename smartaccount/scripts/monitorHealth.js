const ethers = require('ethers');
require('dotenv').config();

const LENDING_POOL_ABI = [
    'function getUserAccountData(address user) public view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)'
];

const AAVE_ORACLE_ABI = [
    'function getAssetPrice(address asset) external view returns (uint256)'
];

const PROTOCOL_DATA_PROVIDER_ABI = [
    'function getUserReserveData(address asset, address user) external view returns (uint256 currentATokenBalance, uint256 currentStableDebt, uint256 currentVariableDebt, uint256 principalStableDebt, uint256 scaledVariableDebt, uint256 stableBorrowRate, uint256 liquidityRate, uint40 stableRateLastUpdated, bool usageAsCollateralEnabled)',
    'function getReserveTokensAddresses(address asset) external view returns (address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress)'
];

const ERC20_ABI = [
    'function symbol() external view returns (string)',
    'function decimals() external view returns (uint8)'
];

async function monitorHealthFactor(targetAddress) {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

    // Contract instances
    const lendingPool = new ethers.Contract(
        process.env.LENDING_POOL_ADDRESS,
        LENDING_POOL_ABI,
        provider
    );

    const aaveOracle = new ethers.Contract(
        process.env.AAVE_ORACLE_ADDRESS,
        AAVE_ORACLE_ABI,
        provider
    );

    const protocolDataProvider = new ethers.Contract(
        process.env.PROTOCOL_DATA_PROVIDER_ADDRESS,
        PROTOCOL_DATA_PROVIDER_ABI,
        provider
    );

    // Health factor thresholds
    const WARNING_THRESHOLD = 1.5;
    const CRITICAL_THRESHOLD = 1.1;

    console.log(`Starting health factor monitoring for address: ${targetAddress}`);
    console.log('Press Ctrl+C to stop monitoring\n');

    async function getTokenDetails(tokenAddress) {
        const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
        const symbol = await tokenContract.symbol();
        const decimals = await tokenContract.decimals();
        return { symbol, decimals };
    }

    async function checkHealthFactor() {
        try {
            const accountData = await lendingPool.getUserAccountData(targetAddress);
            const healthFactor = Number(ethers.formatEther(accountData.healthFactor));
            
            // Get collateral and debt in ETH (18 decimals)
            const totalCollateralETHBig = BigInt(accountData.totalCollateralETH.toString());
            const totalDebtETHBig = BigInt(accountData.totalDebtETH.toString());
            
            // // Format the initial values with correct decimals
            // console.log('Total Collateral (in USD):', (Number(ethers.formatEther(totalCollateralETHBig)) * 1e10).toFixed(2));
            // console.log('Total Debt (in USD):', (Number(ethers.formatEther(totalDebtETHBig)) * 1e10).toFixed(2));
            
            // Get ETH price (8 decimals)
            const ethPrice = await aaveOracle.getAssetPrice(process.env.WETH_TOKEN_ADDRESS);
            const ethPriceUSD = Number(ethers.formatUnits(ethPrice, 8));
            // console.log('ETH Price (in USD):', ethPriceUSD);

            // Get token position details
            const collateralData = await protocolDataProvider.getUserReserveData(
                process.env.COLLATERAL_TOKEN,
                targetAddress
            );
            
            const debtData = await protocolDataProvider.getUserReserveData(
                process.env.DEBT_TOKEN,
                targetAddress
            );

            // Get token symbols
            const collateralToken = await getTokenDetails(process.env.COLLATERAL_TOKEN);
            const debtToken = await getTokenDetails(process.env.DEBT_TOKEN);

            // Calculate USD values
            const totalCollateralUSD = Number(ethers.formatEther(totalCollateralETHBig)) * 1e10;
            const totalDebtUSD = Number(ethers.formatEther(totalDebtETHBig)) * 1e10;

            const timestamp = new Date().toLocaleTimeString();
            
            // Color-coded status based on health factor
            let status;
            if (healthFactor < CRITICAL_THRESHOLD) {
                status = '\x1b[31m[CRITICAL]\x1b[0m';
            } else if (healthFactor < WARNING_THRESHOLD) {
                status = '\x1b[33m[WARNING]\x1b[0m';
            } else {
                status = '\x1b[32m[HEALTHY]\x1b[0m';
            }

            console.log(`${timestamp} ${status} Health Factor: ${healthFactor.toFixed(2)}`);
            console.log(`Collateral: $${totalCollateralUSD.toFixed(2)} | Debt: $${totalDebtUSD.toFixed(2)}`);
            
            // Display token positions
            console.log('\nPosition Details:');
            console.log(`Collateral Token: ${collateralToken.symbol}`);
            console.log(`Collateral Amount: ${ethers.formatUnits(collateralData.currentATokenBalance, collateralToken.decimals)} ${collateralToken.symbol}`);
            console.log(`Debt Token: ${debtToken.symbol}`);
            console.log(`Variable Debt Amount: ${ethers.formatUnits(debtData.currentVariableDebt, debtToken.decimals)} ${debtToken.symbol}`);
            console.log(`Stable Debt Amount: ${ethers.formatUnits(debtData.currentStableDebt, debtToken.decimals)} ${debtToken.symbol}`);
            console.log('----------------------------------------');

            if (healthFactor < CRITICAL_THRESHOLD) {
                console.log('\x1b[31m⚠️  CRITICAL: Health Factor is dangerously low!\x1b[0m');
            }

        } catch (error) {
            console.error('Error checking health factor:', error.message);
        }
    }

    // Initial check
    await checkHealthFactor();

    // Set up monitoring interval (every 30 seconds)
    const monitoringInterval = setInterval(checkHealthFactor, 30000);

    // Handle script termination
    process.on('SIGINT', () => {
        clearInterval(monitoringInterval);
        console.log('\nStopped monitoring health factor');
        process.exit();
    });
}

// Get target address from command line or environment variable
const targetAddress = process.argv[2] || process.env.AI_AGENT_PUBLIC_ADDRESS;

if (!targetAddress) {
    console.error('Please provide an address to monitor as a command line argument or in the .env file');
    process.exit(1);
}

// Start monitoring
monitorHealthFactor(targetAddress)
    .catch(error => {
        console.error('Error in monitoring script:', error);
        process.exit(1);
    });