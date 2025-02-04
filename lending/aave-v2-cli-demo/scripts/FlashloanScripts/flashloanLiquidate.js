const ethers = require('ethers');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load .env file from the root directory
const rootDir = path.resolve(__dirname, '..', '..');
dotenv.config({ path: path.join(rootDir, '.env') });

// Read JSON files
const deployedContractsPath = path.join(rootDir, 'deployed-contracts.json');
const liquidationReferencesPath = path.join(rootDir, 'api3-liquidations', 'liquidationReferences.json');

const deployedContracts = JSON.parse(fs.readFileSync(deployedContractsPath, 'utf8'));
const liquidationReferences = JSON.parse(fs.readFileSync(liquidationReferencesPath, 'utf8'));

// Contract addresses
const lendingPoolAddressesProviderAddress = deployedContracts.LendingPoolAddressesProvider.custom.address;
const protocolDataProviderAddress = deployedContracts.AaveProtocolDataProvider.custom.address;
const flashLoanLiquidationSwapAddress = liquidationReferences.FlashLoanLiquidationSwap;

const mnemonic = process.env.MNEMONIC;
const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL);
// Use the second generated address from the mnemonic
const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic);
const signer = new ethers.Wallet(hdNode.derivePath("m/44'/60'/0'/0/0")).connect(provider);

// Wallet I'm liquidating.. 2nd wallet on mnemonic
const liquidationWallet = new ethers.Wallet(hdNode.derivePath("m/44'/60'/0'/0/1")).connect(provider);

// Address to check (replace with the address you want to potentially liquidate)
const targetAddress = liquidationWallet.address;

// ABIs (you'll need to replace these with the actual ABIs)
const lendingPoolABI = [
  "function getUserAccountData(address user) view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
  "function getReserveData(address asset) view returns (tuple(uint256 configuration, uint128 liquidityIndex, uint128 variableBorrowIndex, uint128 currentLiquidityRate, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint8 id) data)"
];

const protocolDataProviderABI = [
  "function getAllReservesTokens() view returns (tuple(string symbol, address tokenAddress)[])",
  "function getUserReserveData(address asset, address user) view returns (uint256 currentATokenBalance, uint256 currentStableDebt, uint256 currentVariableDebt, uint256 principalStableDebt, uint256 scaledVariableDebt, uint256 stableBorrowRate, uint256 liquidityRate, uint40 stableRateLastUpdated, bool usageAsCollateralEnabled)"
];

const flashLoanLiquidationSwapABI = [
  "function requestFlashLoanAndLiquidate(address _debtAsset, uint256 _debtAmount, address _collateralAsset, address _borrower) external"
];

const erc20ABI = [
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

async function main() {
  // Create contract instances
  const lendingPoolAddressesProvider = new ethers.Contract(lendingPoolAddressesProviderAddress, ["function getLendingPool() view returns (address)"], signer);
  const lendingPoolAddress = await lendingPoolAddressesProvider.getLendingPool();
  const lendingPool = new ethers.Contract(lendingPoolAddress, lendingPoolABI, signer);
  const protocolDataProvider = new ethers.Contract(protocolDataProviderAddress, protocolDataProviderABI, signer);
  const flashLoanLiquidationSwap = new ethers.Contract(flashLoanLiquidationSwapAddress, flashLoanLiquidationSwapABI, signer);

  // Check health factor
  const { totalCollateralETH, totalDebtETH, healthFactor } = await lendingPool.getUserAccountData(targetAddress);
  console.log(`Health Factor: ${ethers.utils.formatUnits(healthFactor, 18)}`);

  if (healthFactor.gt(ethers.utils.parseUnits("1", 18))) {
    console.log("Health factor is above 1, cannot liquidate.");
    return;
  }

  // Find the debt and collateral assets
  const userReserves = await getUserReserves(protocolDataProvider, targetAddress);
  const debtAsset = userReserves.find(r => r.debtBalance.gt(0));
  const collateralAsset = userReserves.find(r => r.collateralBalance.gt(0));

  if (!debtAsset || !collateralAsset) {
    console.log("Could not find suitable debt or collateral asset.");
    return;
  }

  console.log(`Debt Asset: ${debtAsset.tokenAddress}`);
  console.log(`Collateral Asset: ${collateralAsset.tokenAddress}`);

  // Calculate the amount to liquidate (50% of the debt or max allowed by Aave, whichever is lower)
  const maxLiquidationAmount = debtAsset.debtBalance.mul(5000).div(10000); // 50% of the debt
  const debtToCover = totalDebtETH.mul(ethers.utils.parseUnits("0.5", 18)).div(ethers.utils.parseUnits("1", 18));
  const liquidationAmount = maxLiquidationAmount.lt(debtToCover) ? maxLiquidationAmount : debtToCover;

  console.log(`Liquidation Amount: ${ethers.utils.formatUnits(liquidationAmount, debtAsset.decimals)}`);

  // Execute flash loan and liquidation
  try {
    const tx = await flashLoanLiquidationSwap.requestFlashLoanAndLiquidate(
      debtAsset.tokenAddress,
      liquidationAmount,
      collateralAsset.tokenAddress,
      targetAddress
    );
    await tx.wait();
    console.log(`Liquidation executed. Transaction hash: ${tx.hash}`);
  } catch (error) {
    console.error("Error executing liquidation:", error);
  }
}

async function getUserReserves(protocolDataProvider, userAddress) {
  const reserveTokens = await protocolDataProvider.getAllReservesTokens();
  const userReserves = [];

  for (const { tokenAddress } of reserveTokens) {
    const userReserveData = await protocolDataProvider.getUserReserveData(tokenAddress, userAddress);
    const tokenContract = new ethers.Contract(tokenAddress, erc20ABI, protocolDataProvider.provider);
    const decimals = await tokenContract.decimals();

    if (userReserveData.currentATokenBalance.gt(0) || userReserveData.currentVariableDebt.gt(0) || userReserveData.currentStableDebt.gt(0)) {
      userReserves.push({
        tokenAddress,
        collateralBalance: userReserveData.currentATokenBalance,
        debtBalance: userReserveData.currentVariableDebt.add(userReserveData.currentStableDebt),
        decimals
      });
    }
  }

  return userReserves;
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });