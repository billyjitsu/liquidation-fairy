const { ethers } = require('ethers');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

// Read JSON files
const referencesPath = path.join(__dirname, '../api3-adaptors/references.json');
const deployedContractsPath = path.join(__dirname, '../deployed-contracts.json');

let references, deployedContracts;

try {
  references = JSON.parse(fs.readFileSync(referencesPath, 'utf8'));
  deployedContracts = JSON.parse(fs.readFileSync(deployedContractsPath, 'utf8'));
} catch (error) {
  console.error('Error reading JSON files:', error.message);
  process.exit(1);
}

const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL);

const LendingPoolAddressesProviderAddress = deployedContracts.LendingPoolAddressesProvider.custom.address;
const ProtocolDataProviderAddress = deployedContracts.AaveProtocolDataProvider.custom.address;

const LendingPoolAddressesProviderABI = [
  "function getLendingPool() external view returns (address)"
];

const ProtocolDataProviderABI = [
  "function getAllReservesTokens() external view returns (tuple(string symbol, address tokenAddress)[])",
  "function getReserveConfigurationData(address asset) external view returns (uint256 decimals, uint256 ltv, uint256 liquidationThreshold, uint256 liquidationBonus, uint256 reserveFactor, bool usageAsCollateralEnabled, bool borrowingEnabled, bool stableBorrowRateEnabled, bool isActive, bool isFrozen)",
  "function getReserveData(address asset) external view returns (uint256 availableLiquidity, uint256 totalStableDebt, uint256 totalVariableDebt, uint256 liquidityRate, uint256 variableBorrowRate, uint256 stableBorrowRate, uint256 averageStableBorrowRate, uint256 liquidityIndex, uint256 variableBorrowIndex, uint40 lastUpdateTimestamp)"
];

const LendingPoolABI = [
  "function getReserveData(address asset) external view returns (uint256 configuration, uint128 liquidityIndex, uint128 variableBorrowIndex, uint128 currentLiquidityRate, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint8 id)"
];

async function getReserveData() {
  const addressesProvider = new ethers.Contract(LendingPoolAddressesProviderAddress, LendingPoolAddressesProviderABI, provider);
  const protocolDataProvider = new ethers.Contract(ProtocolDataProviderAddress, ProtocolDataProviderABI, provider);

  const lendingPoolAddress = await addressesProvider.getLendingPool();
  const lendingPool = new ethers.Contract(lendingPoolAddress, LendingPoolABI, provider);

  const reserveTokens = await protocolDataProvider.getAllReservesTokens();

  console.log("Reserve Data:");
  console.log("-------------");

  for (const token of reserveTokens) {
    try {
      const { symbol, tokenAddress } = token;
      const configData = await protocolDataProvider.getReserveConfigurationData(tokenAddress);
      const reserveData = await protocolDataProvider.getReserveData(tokenAddress);
      const poolReserveData = await lendingPool.getReserveData(tokenAddress);

      const liquidationThreshold = configData.liquidationThreshold.toNumber() / 10000;
      const ltv = configData.ltv.toNumber() / 10000;
      const liquidationBonus = (configData.liquidationBonus.toNumber() - 10000) / 10000;

      let utilizationRate = ethers.BigNumber.from(0);
      const totalLiquidity = reserveData.availableLiquidity.add(reserveData.totalStableDebt).add(reserveData.totalVariableDebt);
      if (!totalLiquidity.isZero()) {
        utilizationRate = reserveData.totalStableDebt.add(reserveData.totalVariableDebt).mul(ethers.constants.WeiPerEther).div(totalLiquidity);
      }

      console.log(`Token: ${symbol}`);
      console.log(`Address: ${tokenAddress}`);
      console.log(`LTV: ${ltv}`);
      console.log(`Liquidation Threshold: ${liquidationThreshold}`);
      console.log(`Liquidation Bonus: ${liquidationBonus}`);
      console.log(`Borrowing Enabled: ${configData.borrowingEnabled}`);
      console.log(`Usage As Collateral Enabled: ${configData.usageAsCollateralEnabled}`);
      console.log(`Is Active: ${configData.isActive}`);
      console.log(`Is Frozen: ${configData.isFrozen}`);
      console.log(`Available Liquidity: ${ethers.utils.formatUnits(reserveData.availableLiquidity, configData.decimals)}`);
      console.log(`Total Stable Debt: ${ethers.utils.formatUnits(reserveData.totalStableDebt, configData.decimals)}`);
      console.log(`Total Variable Debt: ${ethers.utils.formatUnits(reserveData.totalVariableDebt, configData.decimals)}`);
      console.log(`Utilization Rate: ${ethers.utils.formatUnits(utilizationRate, 16)}%`);
      console.log(`Variable Borrow Rate: ${ethers.utils.formatUnits(reserveData.variableBorrowRate, 25)}%`);
      console.log(`Stable Borrow Rate: ${ethers.utils.formatUnits(reserveData.stableBorrowRate, 25)}%`);
      console.log(`Liquidity Rate: ${ethers.utils.formatUnits(reserveData.liquidityRate, 25)}%`);
      console.log("-------------");
    } catch (error) {
      console.error(`Error processing token at address ${token.tokenAddress}:`, error.message);
      console.log("-------------");
    }
  }
}

async function main() {
  try {
    await getReserveData();
  } catch (error) {
    console.error("An error occurred in the main execution:", error.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });