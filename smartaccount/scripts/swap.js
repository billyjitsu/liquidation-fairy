const ethers = require('ethers');
require('dotenv').config();

const DEX_ABI = [
    "function previewSwap(address _fromToken, address _toToken, uint256 _amount) external view returns (uint256)",
    "function swap(address _fromToken, address _toToken, uint256 _amount) external",
    "function getBalance(address _token) external view returns (uint256)"
];

const ERC20_ABI = [
    "function transfer(address to, uint256 amount) public returns (bool)",
    "function balanceOf(address account) public view returns (uint256)",
    "function approve(address spender, uint256 amount) public returns (bool)",
    "function decimals() public view returns (uint8)"
];

async function previewAndSwap() {
    // Setup provider and wallet using AI agent's private key
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(process.env.AI_AGENT_PRIVATE_KEY, provider);
    
    // Contract instances
    const dex = new ethers.Contract(
        process.env.DEX_ADDRESS,
        DEX_ABI,
        wallet
    );
    
    const fromToken = new ethers.Contract(
        process.env.COLLATERAL_TOKEN,
        ERC20_ABI,
        wallet
    );

    const toToken = new ethers.Contract(
        process.env.DEBT_TOKEN,
        ERC20_ABI,
        wallet
    );

    try {
        // Get decimals for both tokens
        const fromDecimals = await fromToken.decimals();
        const toDecimals = await toToken.decimals();
        console.log(`From Token Decimals: ${fromDecimals}`);
        console.log(`To Token Decimals: ${toDecimals}`);

        const swapAmount = ethers.parseUnits("10", fromDecimals);
        console.log(`Swap Amount (formatted): ${ethers.formatUnits(swapAmount, fromDecimals)}`);

        // Check token balances
        const fromBalance = await fromToken.balanceOf(wallet.address);
        console.log('From Token Balance:', ethers.formatUnits(fromBalance, fromDecimals));

        // Preview swap
        console.log('\nPreviewing swap...');
        const expectedOutput = await dex.previewSwap(
            process.env.COLLATERAL_TOKEN,
            process.env.DEBT_TOKEN,
            swapAmount
        );
        console.log('Expected output amount:', ethers.formatUnits(expectedOutput, toDecimals));

        // Check DEX balance
        const dexBalance = await dex.getBalance(process.env.DEBT_TOKEN);
        console.log('\nDEX balance of to token:', ethers.formatUnits(dexBalance, toDecimals));

        // Approve tokens for DEX
        console.log('\nApproving tokens for DEX...');
        const approveTx = await fromToken.approve(
            process.env.DEX_ADDRESS,
            swapAmount
        );
        await approveTx.wait();
        console.log('Approval transaction completed:', approveTx.hash);

        // Execute swap
        console.log('\nExecuting swap...');
        const swapTx = await dex.swap(
            process.env.COLLATERAL_TOKEN,
            process.env.DEBT_TOKEN,
            swapAmount
        );
        await swapTx.wait();
        console.log('Swap transaction completed:', swapTx.hash);

        // Check final balances
        const finalFromBalance = await fromToken.balanceOf(wallet.address);
        const finalToBalance = await toToken.balanceOf(wallet.address);
        console.log('\nFinal balances:');
        console.log('From token:', ethers.formatUnits(finalFromBalance, fromDecimals));
        console.log('To token:', ethers.formatUnits(finalToBalance, toDecimals));

    } catch (error) {
        console.error('Error during swap:', error);
        if (error.error) {
            console.error('Detailed error:', error.error);
        }
        throw error;
    }
}

// Execute the swap
previewAndSwap()
    .then(() => {
        console.log('\nAll operations completed successfully');
        process.exit(0);
    })
    .catch(error => {
        console.error('Unhandled error in main execution:', error);
        process.exit(1);
    });