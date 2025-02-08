const ethers = require('ethers');
require('dotenv').config();

const LENDING_POOL_ABI = [
    'function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) public',
    'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) public',
    'function getUserAccountData(address user) public view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)'
];

const ERC20_ABI = [
    "function transfer(address to, uint256 amount) public returns (bool)",
    "function balanceOf(address account) public view returns (uint256)",
    "function approve(address spender, uint256 amount) public returns (bool)"
];

async function depositToLendingPool() {
    // Setup provider and wallet
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    
    // Contract instances
    const lendingPool = new ethers.Contract(
        process.env.LENDING_POOL_ADDRESS,
        LENDING_POOL_ABI,
        wallet
    );
    
    const collateralToken = new ethers.Contract(
        process.env.COLLATERAL_TOKEN,
        ERC20_ABI,
        wallet
    );

    const depositAmount = ethers.parseUnits("1000", 18); // Adjust amount as needed
    const referralCode = 0;

    try {
        // Check token balance
        const balance = await collateralToken.balanceOf(wallet.address);
        console.log('Token Balance:', ethers.formatUnits(balance, 18));

        // Approve tokens for LendingPool
        console.log('Approving tokens for LendingPool...');
        const approveTx = await collateralToken.approve(
            process.env.LENDING_POOL_ADDRESS,
            depositAmount
        );
        await approveTx.wait();
        console.log('Approval transaction completed:', approveTx.hash);

        // Deposit tokens to LendingPool
        console.log('Depositing tokens to LendingPool...');
        const depositTx = await lendingPool.deposit(
            process.env.COLLATERAL_TOKEN,
            depositAmount,
            wallet.address,
            referralCode
        );
        await depositTx.wait();
        console.log('Deposit transaction completed:', depositTx.hash);

        // Check account data after deposit
        await checkAccountData(lendingPool, wallet.address);

    } catch (error) {
        console.error('Error during deposit:', error);
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
depositToLendingPool()
    .then(() => {
        console.log('All operations completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('Unhandled error in main execution:', error);
        process.exit(1);
    });