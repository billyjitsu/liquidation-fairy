import { ethers } from "ethers";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env from parent directory
dotenv.config({ path: resolve(__dirname, "../../.env") });

// Debug env loading
console.log("Environment variables loaded:", {
  RPC_URL: process.env.RPC_URL,
  AI_AGENT_PRIVATE_KEY:
    process.env.AI_AGENT_PRIVATE_KEY?.substring(0, 6) + "...",
});

const MULTISIG_ABI = [
  "function delegatedTransfer(address _token, address _to, uint256 _amount) public returns (bool)",
  "function getDelegationStatus(address _token, address _delegate) public view returns (uint256 dailyLimit, uint256 spentToday, uint256 remainingToday, uint256 timeUntilReset, uint256 confirmations, bool isActive)",
];

const LENDING_POOL_ABI = [
  "function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode) public",
  "function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf) public",
  "function getUserAccountData(address user) public view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
  "function repay(address asset, uint256 amount, uint256 rateMode, address onBehalfOf) public",
];

const ERC20_ABI = [
  "function transfer(address to, uint256 amount) public returns (bool)",
  "function balanceOf(address account) public view returns (uint256)",
  "function approve(address spender, uint256 amount) public returns (bool)",
  "function decimals() public view returns (uint8)",
];

const AAVE_ORACLE_ABI = [
  "function getAssetPrice(address asset) external view returns (uint256)",
];

const PROTOCOL_DATA_PROVIDER_ABI = [
  "function getUserReserveData(address asset, address user) external view returns (uint256 currentATokenBalance, uint256 currentStableDebt, uint256 currentVariableDebt, uint256 principalStableDebt, uint256 scaledVariableDebt, uint256 stableBorrowRate, uint256 liquidityRate, uint40 stableRateLastUpdated, bool usageAsCollateralEnabled)",
];

const DEBT_TOKEN_ABI = [
  "function borrowAllowance(address fromUser, address toUser) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
];

const DEX_ABI = [
  "function previewSwap(address _fromToken, address _toToken, uint256 _amount) external view returns (uint256)",
  "function swap(address _fromToken, address _toToken, uint256 _amount) external",
  "function getBalance(address _token) external view returns (uint256)",
];

export class Web3Service {
  private static instance: Web3Service;

  private constructor() {}

  static getInstance(): Web3Service {
    if (!Web3Service.instance) {
      Web3Service.instance = new Web3Service();
    }

    return Web3Service.instance;
  }

  /**
   * Generates a new Ethereum wallet with a random private key
   * @returns Object containing the wallet address and private key
   * @throws Error if wallet generation fails
   */
  async generateNewWallet(): Promise<{
    walletAddress: string;
    privateKey: string;
    mnemonic: string;
  }> {
    const wallet = ethers.Wallet.createRandom();

    if (!wallet.mnemonic?.phrase) {
      throw new Error("Failed to generate wallet mnemonic");
    }

    return {
      walletAddress: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic.phrase,
    };
  }

  /**
   * Withdraws collateral and debt tokens from a multisig wallet using delegated transfer
   * @param privateKey - The private key of the delegated wallet
   * @param multisigAddress - The address of the multisig wallet
   * @param collateralTokenAddress - The address of the collateral token contract
   * @param debtTokenAddress - The address of the debt token contract
   * @throws Error if delegations are not active or if withdrawal fails
   */
  async withdrawTokensFromMultisig(
    privateKey: string,
    multisigAddress: string,
    collateralTokenAddress: string,
    debtTokenAddress: string
  ): Promise<void> {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    // Fix: Use Wallet constructor instead of fromPhrase
    const wallet = new ethers.Wallet(privateKey, provider);
    const multisig = new ethers.Contract(multisigAddress, MULTISIG_ABI, wallet);
    const collateralToken = new ethers.Contract(
      collateralTokenAddress,
      ERC20_ABI,
      provider
    );
    const debtToken = new ethers.Contract(
      debtTokenAddress,
      ERC20_ABI,
      provider
    );

    console.log("Checking delegation status...");

    const [collateralStatus, debtStatus] = await Promise.all([
      multisig.getDelegationStatus(collateralTokenAddress, wallet.address),
      multisig.getDelegationStatus(debtTokenAddress, wallet.address),
    ]);

    console.log("Collateral Delegation Status:", collateralStatus);
    console.log("Debt Delegation Status:", debtStatus);

    if (!collateralStatus[5] || !debtStatus[5]) {
      throw new Error("Delegations not active for one or both tokens");
    }

    // Get available amounts within daily limits
    const collateralAvailable = collateralStatus[2]; // remainingToday
    const debtAvailable = debtStatus[2]; // remainingToday

    console.log(
      `Available to withdraw: ${ethers.formatUnits(
        collateralAvailable,
        18
      )} Collateral Token`
    );
    console.log(
      `Available to withdraw: ${ethers.formatUnits(
        debtAvailable,
        6
      )} Debt Token`
    );

    // Check multisig balances
    const [collateralBalance, debtBalance] = await Promise.all([
      collateralToken.balanceOf(multisigAddress),
      debtToken.balanceOf(multisigAddress),
    ]);

    // Calculate withdrawal amounts (use the minimum of available limit and balance)
    const collateralAmount =
      collateralBalance < collateralAvailable
        ? collateralBalance
        : collateralAvailable;
    const debtAmount =
      debtBalance < debtAvailable ? debtBalance : debtAvailable;

    if (collateralAmount > 0) {
      console.log(
        `Withdrawing ${ethers.formatUnits(
          collateralAmount,
          18
        )} Collateral Token...`
      );
      const collateral_testing_amount = ethers.parseUnits("10", 18);
      const tx1 = await multisig.delegatedTransfer(
        collateralTokenAddress,
        wallet.address,
        collateral_testing_amount, // instead of collateralAmount, using 10 tokens
        { gasLimit: 300000 }
      );
      await tx1.wait();
      console.log("Collateral Token withdrawal complete:", tx1.hash);
    }

    if (debtAmount > 0) {
      console.log(
        `Withdrawing ${ethers.formatUnits(debtAmount, 6)} Debt Token...`
      );
      const debt_testing_amount = ethers.parseUnits("10", 6);
      const tx2 = await multisig.delegatedTransfer(
        debtTokenAddress,
        wallet.address,
        debt_testing_amount, // removed debt amount and added debt_testing_amount
        { gasLimit: 300000 }
      );
      await tx2.wait();
      console.log("Debt Token withdrawal complete:", tx2.hash);
    }

    // Final balance check
    const [finalCollateralBalance, finalDebtBalance] = await Promise.all([
      collateralToken.balanceOf(wallet.address),
      debtToken.balanceOf(wallet.address),
    ]);

    console.log("\nFinal Balances:");
    console.log(
      `Collateral Token: ${ethers.formatUnits(finalCollateralBalance, 18)}`
    );
    console;
  }
  catch(error) {
    console.error("Error during withdrawal:", error.message);
    throw error;
  }

  /**
   * Deposits collateral tokens into the lending pool on behalf of a multisig wallet
   * @param privateKey The private key of the AI agent wallet that will execute the deposit
   * @param multisigAddress The address of the multisig wallet that will receive the deposit
   * @param lendingPoolAddress The address of the lending pool contract
   * @param collateralTokenAddress The address of the collateral token to deposit
   */
  async depositOnBehalf(
    privateKey: string,
    multisigAddress: string,
    lendingPoolAddress: string,
    collateralTokenAddress: string,
    debtTokenAddress: string
  ): Promise<void> {
    // Setup provider and AI agent wallet (signer)
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const aiWallet = new ethers.Wallet(privateKey, provider);

    console.log("AI Agent Address:", aiWallet.address);
    console.log("Depositing on behalf of MultiSig:", multisigAddress);

    // Contract instances with AI wallet as signer
    const lendingPool = new ethers.Contract(
      lendingPoolAddress,
      LENDING_POOL_ABI,
      aiWallet
    );

    const collateralToken = new ethers.Contract(
      collateralTokenAddress,
      ERC20_ABI,
      aiWallet
    );

    const depositAmount = ethers.parseUnits("10", 18); // Adjust amount as needed
    const referralCode = 0;

    // Check AI agent's token balance
    const balance = await collateralToken.balanceOf(aiWallet.address);
    const decimals = await collateralToken.decimals();
    console.log(
      "AI Agent Token Balance:",
      ethers.formatUnits(balance, decimals)
    );

    // Check if AI agent has enough tokens
    if (balance < depositAmount) {
      console.error("Insufficient balance for deposit");
      console.log("Required:", ethers.formatUnits(depositAmount, decimals));
      console.log("Available:", ethers.formatUnits(balance, decimals));
      process.exit(1);
    }

    // Approve tokens for LendingPool
    console.log("Approving tokens for LendingPool...");
    const approveTx = await collateralToken.approve(
      lendingPoolAddress,
      depositAmount
    );
    await approveTx.wait();
    console.log("Approval transaction completed:", approveTx.hash);

    // Deposit tokens to LendingPool on behalf of MultiSig
    console.log("Depositing tokens to LendingPool...");
    const depositTx = await lendingPool.deposit(
      collateralTokenAddress,
      depositAmount,
      multisigAddress,
      referralCode
    );
    await depositTx.wait();
    console.log("Deposit transaction completed:", depositTx.hash);

    // Check MultiSig's account data after deposit
    await this.checkAccountData(lendingPool, multisigAddress);
  }

  async borrowOnBehalf(
    privateKey: string,
    multisigAddress: string,
    debtTokenAddress: string,
    lendingPoolAddress: string,
    collateralTokenAddress: string
  ) {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const aiWallet = new ethers.Wallet(privateKey, provider);

    console.log("AI Agent Address:", aiWallet.address);
    console.log("Borrowing on behalf of MultiSig:", multisigAddress);

    // Check delegation allowance first
    const debtToken = new ethers.Contract(
      process.env.VARIABLE_DEBT_TOKEN,
      DEBT_TOKEN_ABI,
      provider
    );

    console.log("Checking borrow allowance...");
    const borrowAllowance = await debtToken.borrowAllowance(
      multisigAddress,
      aiWallet.address
    );

    const debtDecimals = await debtToken.decimals();
    console.log(
      "Current borrow allowance:",
      ethers.formatUnits(borrowAllowance, debtDecimals),
      "USDC"
    );

    if (borrowAllowance.toString() === "0") {
      console.error("\nError: No borrowing allowance");
      console.error(
        "The AI agent does not have permission to borrow on behalf of the MultiSig"
      );
      console.error("Please run the credit delegation setup script first");
      process.exit(1);
    }

    // Initialize contracts with AI wallet
    const collateralToken = new ethers.Contract(
      collateralTokenAddress,
      ERC20_ABI,
      aiWallet
    );

    const lendingPool = new ethers.Contract(
      lendingPoolAddress,
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
    const ethPrice = await this.getAssetPrice(
      aaveOracle,
      process.env.WETH_TOKEN_ADDRESS
    );
    console.log("ETH Price (in USD):", ethers.formatUnits(ethPrice, 8));

    // Get collateral price
    const collateralPrice = await this.getAssetPrice(
      aaveOracle,
      process.env.COLLATERAL_TOKEN
    );
    console.log(
      "Collateral Price (in USD):",
      ethers.formatUnits(collateralPrice, 8)
    );

    // Get deposited collateral balance for MultiSig
    const userReserveData = await protocolDataProvider.getUserReserveData(
      collateralTokenAddress,
      multisigAddress
    );
    const depositedCollateralBalance = userReserveData.currentATokenBalance;
    const collateralDecimals = await collateralToken.decimals();
    console.log(
      "MultiSig Deposited Collateral Balance:",
      ethers.formatUnits(depositedCollateralBalance, collateralDecimals)
    );

    // Calculate collateral value in USD
    const depositedBalanceBigInt = BigInt(
      depositedCollateralBalance.toString()
    );
    const collateralPriceBigInt = BigInt(collateralPrice.toString());
    const decimalsBigInt = 10n ** BigInt(collateralDecimals.toString());

    const collateralValueInUsd =
      (depositedBalanceBigInt * collateralPriceBigInt) / decimalsBigInt;
    const totalCollateralUSD = Number(
      ethers.formatUnits(collateralValueInUsd, 8)
    );
    console.log("Total Collateral USD:", totalCollateralUSD.toFixed(2));

    // Get MultiSig's account data
    const accountData = await lendingPool.getUserAccountData(multisigAddress);

    // Get user's debt data
    const debtData = await protocolDataProvider.getUserReserveData(
      debtTokenAddress,
      multisigAddress
    );

    const totalVariableDebt = Number(
      ethers.formatUnits(debtData.currentVariableDebt, debtDecimals)
    );
    const totalStableDebt = Number(
      ethers.formatUnits(debtData.currentStableDebt, debtDecimals)
    );
    const totalDebtUSD = totalVariableDebt + totalStableDebt;

    // Calculate LTV percentage
    const ltvPercentage = Number(accountData.ltv) / 100;
    console.log("LTV:", `${ltvPercentage}%`);

    console.log(`Current Variable Debt: ${totalVariableDebt.toFixed(2)} USDC`);
    console.log(`Current Stable Debt: ${totalStableDebt.toFixed(2)} USDC`);
    console.log("Total Debt USD:", totalDebtUSD.toFixed(2));

    // Calculate available borrows
    const availableBorrowsUSD =
      totalCollateralUSD * (ltvPercentage / 100) - totalDebtUSD;
    console.log("Available Borrows USD:", availableBorrowsUSD.toFixed(2));

    // Get debt token price
    const debtTokenPrice = await this.getAssetPrice(
      aaveOracle,
      debtTokenAddress
    );
    console.log(
      "Debt Token Price (in USD):",
      ethers.formatUnits(debtTokenPrice, 8)
    );

    // Calculate maximum borrow amount
    const maxBorrowUSDC = Math.min(
      availableBorrowsUSD,
      Number(ethers.formatUnits(borrowAllowance, debtDecimals))
    );
    console.log("Maximum Borrowable (USDC):", maxBorrowUSDC.toFixed(6));

    // Set borrow amount to desired percentage of maximum
    const borrowPercentage = 100;
    const borrowAmount = Math.floor((maxBorrowUSDC * borrowPercentage) / 100);
    console.log("Attempting to borrow:", borrowAmount.toFixed(6), "USDC");

    if (borrowAmount <= 0) {
      console.log("Cannot borrow: Amount is zero or negative");
      return;
    }

    // Convert to Wei (6 decimals for USDC)
    const borrowAmountWei = ethers.parseUnits(borrowAmount.toFixed(6), 6);
    console.log("Borrow Amount (Wei):", borrowAmountWei.toString());

    // Check against delegation allowance
    if (borrowAmountWei > borrowAllowance) {
      console.error("\nError: Borrow amount exceeds delegation allowance");
      console.error(
        "Attempting to borrow:",
        ethers.formatUnits(borrowAmountWei, debtDecimals),
        "USDC"
      );
      console.error(
        "Allowance:",
        ethers.formatUnits(borrowAllowance, debtDecimals),
        "USDC"
      );
      process.exit(1);
    }

    const VARIABLE_RATE_MODE = 2;
    const referralCode = 0;

    // Estimate gas
    const estimatedGas = await lendingPool.borrow.estimateGas(
      debtTokenAddress,
      borrowAmountWei,
      VARIABLE_RATE_MODE,
      referralCode,
      multisigAddress
    );

    console.log("Estimated gas:", estimatedGas.toString());

    // Add 20% buffer to gas estimate
    const gasLimit = (estimatedGas * BigInt(120)) / BigInt(100);
    console.log("Gas limit with buffer:", gasLimit.toString());

    console.log("Executing borrow transaction...");
    const borrowTx = await lendingPool.borrow(
      debtTokenAddress,
      borrowAmountWei,
      VARIABLE_RATE_MODE,
      referralCode,
      multisigAddress,
      {
        gasLimit: gasLimit,
      }
    );

    console.log("Borrow transaction sent. Waiting for confirmation...");
    const receipt = await borrowTx.wait();

    if (receipt.status === 1) {
      console.log("Borrow transaction completed successfully");
      console.log("Transaction hash:", receipt.hash);
    } else {
      console.log("Borrow transaction failed");
    }

    // Create new contract instance for checking balance using ERC20 ABI
    const debtTokenERC20 = new ethers.Contract(
      debtTokenAddress,
      ERC20_ABI,
      provider
    );

    const balance = await debtTokenERC20.balanceOf(multisigAddress);
    console.log(
      "MultiSig Debt Token Balance after borrowing:",
      ethers.formatUnits(balance, debtDecimals)
    );

    // Check final health factor
    const finalAccountData = await lendingPool.getUserAccountData(
      multisigAddress
    );
    console.log(
      "Health Factor:",
      ethers.formatEther(finalAccountData.healthFactor)
    );
  }

  /**
   * Swaps tokens between collateral and debt tokens using a DEX
   * @param privateKey - The private key of the wallet executing the swap
   * @param collateralTokenAddress - The address of the collateral token to swap from
   * @param debtTokenAddress - The address of the debt token to swap to
   * @throws Error if swap fails or if token approvals fail
   */
  async swapTokensOnBehalf(
    privateKey: string,
    collateralTokenAddress: string,
    debtTokenAddress: string
  ) {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);

    // Contract instances
    const dex = new ethers.Contract(process.env.DEX_ADDRESS, DEX_ABI, wallet);

    const fromToken = new ethers.Contract(
      collateralTokenAddress,
      ERC20_ABI,
      wallet
    );

    const toToken = new ethers.Contract(debtTokenAddress, ERC20_ABI, wallet);

    // Get decimals for both tokens
    const fromDecimals = await fromToken.decimals();
    const toDecimals = await toToken.decimals();
    console.log(`From Token Decimals: ${fromDecimals}`);
    console.log(`To Token Decimals: ${toDecimals}`);

    const swapAmount = ethers.parseUnits("10", fromDecimals);
    console.log(
      `Swap Amount (formatted): ${ethers.formatUnits(swapAmount, fromDecimals)}`
    );

    // Check token balances
    const fromBalance = await fromToken.balanceOf(wallet.address);
    console.log(
      "From Token Balance:",
      ethers.formatUnits(fromBalance, fromDecimals)
    );

    // Preview swap
    console.log("\nPreviewing swap...");
    const expectedOutput = await dex.previewSwap(
      collateralTokenAddress,
      debtTokenAddress,
      swapAmount
    );
    console.log(
      "Expected output amount:",
      ethers.formatUnits(expectedOutput, toDecimals)
    );

    // Check DEX balance
    const dexBalance = await dex.getBalance(debtTokenAddress);
    console.log(
      "\nDEX balance of to token:",
      ethers.formatUnits(dexBalance, toDecimals)
    );

    // Approve tokens for DEX
    console.log("\nApproving tokens for DEX...");
    const approveTx = await fromToken.approve(
      process.env.DEX_ADDRESS,
      swapAmount
    );
    await approveTx.wait();
    console.log("Approval transaction completed:", approveTx.hash);

    // Execute swap
    console.log("\nExecuting swap...");
    const swapTx = await dex.swap(
      collateralTokenAddress,
      debtTokenAddress,
      swapAmount
    );
    await swapTx.wait();
    console.log("Swap transaction completed:", swapTx.hash);

    // Check final balances
    const finalFromBalance = await fromToken.balanceOf(wallet.address);
    const finalToBalance = await toToken.balanceOf(wallet.address);
    console.log("\nFinal balances:");
    console.log(
      "From token:",
      ethers.formatUnits(finalFromBalance, fromDecimals)
    );
    console.log("To token:", ethers.formatUnits(finalToBalance, toDecimals));
  }

  /**
   * Transfers collateral and debt tokens to a multisig wallet on behalf of the AI agent
   * @param privateKey - The private key of the AI agent wallet that will execute the transfers
   * @param multisigAddress - The address of the multisig wallet that will receive the tokens
   * @param collateralTokenAddress - The address of the collateral token contract
   * @param debtTokenAddress - The address of the debt token contract (USDC)
   * @param collateralAmount - The amount of collateral tokens to transfer
   * @param debtAmount - The amount of debt tokens (USDC) to transfer
   * @throws Error if transfers fail
   */
  async transferTokensOnBehalf(
    privateKey: string,
    multisigAddress: string,
    collateralTokenAddress: string,
    debtTokenAddress: string,
    collateralAmount: string,
    debtAmount: string
  ) {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);

    const collateralToken = new ethers.Contract(
      collateralTokenAddress,
      ERC20_ABI,
      wallet
    );
    const debtToken = new ethers.Contract(debtTokenAddress, ERC20_ABI, wallet);

    // Transfer collateral token
    console.log("Transferring collateral tokens...");
    const collateralTx = await collateralToken.transfer(
      multisigAddress,
      collateralAmount
    );
    await collateralTx.wait();
    console.log("Collateral token transfer complete:", collateralTx.hash);

    // Transfer debt token (USDC)
    console.log("Transferring debt tokens...");
    const debtTx = await debtToken.transfer(multisigAddress, debtAmount);
    await debtTx.wait();
    console.log("Debt token transfer complete:", debtTx.hash);
  }

  /**
   * Repays a loan on behalf of another borrower using the AI agent's wallet
   * @param borrowerPrivateKey - The private key of the original borrower whose loan will be repaid
   * @param privateKey - The private key of the AI agent wallet that will execute the repayment
   * @param debtTokenAddress - The address of the debt token contract (USDC)
   * @param lendingPoolAddress - The address of the Aave lending pool contract
   * @throws Error if repayment fails or if unable to check account data
   */
  async repayOnBehalf(
    borrowerPrivateKey: string,
    privateKey: string,
    debtTokenAddress: string,
    lendingPoolAddress: string
  ) {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

    // Setup the original borrower's wallet (for checking their debt)
    const borrowerWallet = new ethers.Wallet(borrowerPrivateKey, provider);

    // Setup AI wallet that will pay the debt
    const aiWallet = new ethers.Wallet(privateKey, provider);

    console.log("Original Borrower Address:", borrowerWallet.address);
    console.log("AI Wallet Address (paying the debt):", aiWallet.address);

    // Contract instances connected to AI wallet since it's doing the repayment
    const debtToken = new ethers.Contract(
      debtTokenAddress,
      ERC20_ABI,
      aiWallet
    );

    const lendingPool = new ethers.Contract(
      lendingPoolAddress,
      LENDING_POOL_ABI,
      aiWallet
    );

    const amount = ethers.parseUnits("300", 6); // USDC has 6 decimals
    const VARIABLE_RATE_MODE = 2; // 2 for variable rate

    // Check AI wallet's token balance before repayment
    const aiBalance = await debtToken.balanceOf(aiWallet.address);
    console.log(
      "AI Wallet Token Balance before repayment:",
      ethers.formatUnits(aiBalance, 6)
    );

    // Check borrower's debt before repayment
    const borrowerAccountData = await lendingPool.getUserAccountData(
      borrowerWallet.address
    );
    console.log(
      "Borrower Debt Before (ETH):",
      ethers.formatEther(borrowerAccountData.totalDebtETH)
    );

    console.log("AI Wallet approving tokens for LendingPool...");
    const approveTx = await debtToken.approve(lendingPoolAddress, amount, {
      gasLimit: BigInt(500000),
    });

    await approveTx.wait();
    console.log("Approval transaction completed:", approveTx.hash);

    console.log("AI Wallet repaying loan...");
    const repayTx = await lendingPool.repay(
      debtTokenAddress,
      amount,
      VARIABLE_RATE_MODE,
      borrowerWallet.address, // repaying on behalf of the original borrower
      {
        gasLimit: BigInt(500000),
      }
    );

    await repayTx.wait();
    console.log("Repay transaction completed:", repayTx.hash);

    // Check balances after repayment
    const newAiBalance = await debtToken.balanceOf(aiWallet.address);
    console.log(
      "AI Wallet Token Balance after repayment:",
      ethers.formatUnits(newAiBalance, 6)
    );

    // Check borrower's final debt
    await this.checkAccountData(lendingPool, borrowerWallet.address);
  }

  /**
   * Retrieves and logs account data for a multisig wallet from the lending pool
   * @param lendingPool - The lending pool contract instance
   * @param multisigAddress - The address of the multisig wallet to check
   * @throws Error if unable to retrieve account data
   */
  private async checkAccountData(
    lendingPool: ethers.Contract,
    multisigAddress: string
  ): Promise<void> {
    try {
      const accountData = await lendingPool.getUserAccountData(multisigAddress);
      console.log("MultiSig Account Data:");
      console.log(
        "Total Collateral (ETH):",
        ethers.formatEther(accountData.totalCollateralETH)
      );
      console.log(
        "Total Debt (ETH):",
        ethers.formatEther(accountData.totalDebtETH)
      );
      console.log(
        "Available Borrows (ETH):",
        ethers.formatEther(accountData.availableBorrowsETH)
      );
      console.log(
        "Current Liquidation Threshold:",
        accountData.currentLiquidationThreshold.toString()
      );
      console.log("LTV:", accountData.ltv.toString());
      console.log(
        "Health Factor:",
        ethers.formatEther(accountData.healthFactor)
      );
    } catch (error) {
      console.error("Error checking account data:", error);
    }
  }

  /**
   * Gets the price of an asset from the Aave Oracle
   * @param aaveOracle - The Aave Oracle contract instance
   * @param assetAddress - The address of the asset to get the price for
   * @returns The price of the asset in USD with 8 decimals
   * @throws Error if unable to retrieve asset price
   */
  private async getAssetPrice(
    aaveOracle: ethers.Contract,
    assetAddress: string
  ) {
    const assetPrice = await aaveOracle.getAssetPrice(assetAddress);
    return assetPrice;
  }

  async getHealthFactor(
    lendingPoolAddress: string,
    multisigAddress: string
  ): Promise<number> {
    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
    const lendingPool = new ethers.Contract(
      lendingPoolAddress,
      LENDING_POOL_ABI,
      provider
    );
    const accountData = await lendingPool.getUserAccountData(multisigAddress);
    // Convert the health factor from BigNumber to a number for easier comparison.
    const healthFactor = Number(ethers.formatEther(accountData.healthFactor));
    return healthFactor;
  }
}

export default Web3Service.getInstance();
