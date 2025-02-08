const ethers = require('ethers');
require('dotenv').config();

const ERC20_ABI = [
    'function balanceOf(address account) public view returns (uint256)',
    'function decimals() public view returns (uint8)',
    'function approve(address spender, uint256 amount) public returns (bool)'
];

const LENDING_POOL_ABI = [
    'function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) public',
    'function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) public',
    'function getUserAccountData(address user) public view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)',
    'function repay(address asset, uint256 amount, uint256 rateMode, address onBehalfOf) public'
];

async function repayDebtTokens() {
    try {
        const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
        
        // Setup the original borrower's wallet (for checking their debt)
        const borrowerWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        
        // Setup AI wallet that will pay the debt
        const aiWallet = new ethers.Wallet(process.env.AI_AGENT_PRIVATE_KEY, provider);
        
        console.log('Original Borrower Address:', borrowerWallet.address);
        console.log('AI Wallet Address (paying the debt):', aiWallet.address);

        // Contract instances connected to AI wallet since it's doing the repayment
        const debtToken = new ethers.Contract(
            process.env.DEBT_TOKEN,
            ERC20_ABI,
            aiWallet
        );

        const lendingPool = new ethers.Contract(
            process.env.LENDING_POOL_ADDRESS,
            LENDING_POOL_ABI,
            aiWallet
        );

        const amount = ethers.parseUnits("300", 6); // USDC has 6 decimals
        const VARIABLE_RATE_MODE = 2; // 2 for variable rate

        // Check AI wallet's token balance before repayment
        const aiBalance = await debtToken.balanceOf(aiWallet.address);
        console.log('AI Wallet Token Balance before repayment:', ethers.formatUnits(aiBalance, 6));

        // Check borrower's debt before repayment
        const borrowerAccountData = await lendingPool.getUserAccountData(borrowerWallet.address);
        console.log('Borrower Debt Before (ETH):', ethers.formatEther(borrowerAccountData.totalDebtETH));

        console.log('AI Wallet approving tokens for LendingPool...');
        const approveTx = await debtToken.approve(
            process.env.LENDING_POOL_ADDRESS,
            amount,
            {
                gasLimit: BigInt(500000)
            }
        );
        
        await approveTx.wait();
        console.log('Approval transaction completed:', approveTx.hash);

        console.log('AI Wallet repaying loan...');
        const repayTx = await lendingPool.repay(
            process.env.DEBT_TOKEN,
            amount,
            VARIABLE_RATE_MODE,
            borrowerWallet.address, // repaying on behalf of the original borrower
            {
                gasLimit: BigInt(500000)
            }
        );

        const receipt = await repayTx.wait();
        console.log('Repay transaction completed:', repayTx.hash);

        // Check balances after repayment
        const newAiBalance = await debtToken.balanceOf(aiWallet.address);
        console.log('AI Wallet Token Balance after repayment:', ethers.formatUnits(newAiBalance, 6));

        // Check borrower's final debt
        await checkAccountData(lendingPool, borrowerWallet.address);

    } catch (error) {
        console.error('Error:', error);
        if (error.error) {
            console.error('Detailed error:', error.error);
        }
        throw error;
    }
}

async function checkAccountData(lendingPool, userAddress) {
    try {
        const accountData = await lendingPool.getUserAccountData(userAddress);
        console.log('Borrower Account Data:');
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

// Execute the repayment
repayDebtTokens()
    .then(() => {
        console.log('All operations completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('Unhandled error in main execution:', error);
        process.exit(1);
    });