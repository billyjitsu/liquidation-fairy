import {
  oneRay,
  ZERO_ADDRESS,
  MOCK_CHAINLINK_AGGREGATORS_PRICES,
  oneEther,
} from '../../helpers/constants';
import { ICommonConfiguration, eEthereumNetwork } from '../../helpers/types';
import * as fs from 'fs';

const rawData = fs.readFileSync('././api3-adaptors/references.json');
const config = JSON.parse(rawData.toString());

console.log(config);

export function populateLendingRateOracleRatesCommon() {
  // Read the references.json file
  const data = fs.readFileSync('././api3-adaptors/references.json', 'utf8');
  const config = JSON.parse(data);

  // Initialize the LendingRateOracleRatesCommon object
  const LendingRateOracleRatesCommon = {
    WETH: { borrowRate: oneRay.multipliedBy(0.03).toFixed() },
    DAI: { borrowRate: oneRay.multipliedBy(0.039).toFixed() },
    TUSD: { borrowRate: oneRay.multipliedBy(0.035).toFixed() },
    USDC: { borrowRate: oneRay.multipliedBy(0.039).toFixed() },
    SUSD: { borrowRate: oneRay.multipliedBy(0.035).toFixed() },
    USDT: { borrowRate: oneRay.multipliedBy(0.035).toFixed() },
    BAT: { borrowRate: oneRay.multipliedBy(0.03).toFixed() },
    AAVE: { borrowRate: oneRay.multipliedBy(0.03).toFixed() },
    LINK: { borrowRate: oneRay.multipliedBy(0.03).toFixed() },
    KNC: { borrowRate: oneRay.multipliedBy(0.03).toFixed() },
    MKR: { borrowRate: oneRay.multipliedBy(0.03).toFixed() },
    MANA: { borrowRate: oneRay.multipliedBy(0.03).toFixed() },
    ZRX: { borrowRate: oneRay.multipliedBy(0.03).toFixed() },
    SNX: { borrowRate: oneRay.multipliedBy(0.03).toFixed() },
    YFI: { borrowRate: oneRay.multipliedBy(0.03).toFixed() },
    REN: { borrowRate: oneRay.multipliedBy(0.03).toFixed() },
    UNI: { borrowRate: oneRay.multipliedBy(0.03).toFixed() },
    ENJ: { borrowRate: oneRay.multipliedBy(0.03).toFixed() },
    BUSD: { borrowRate: oneRay.multipliedBy(0.05).toFixed() },
  };

  for (const asset of config.assets) {
    // Add the asset to the LendingRateOracleRatesCommon object with the borrow rate
    LendingRateOracleRatesCommon[asset.assetSymbol] = { borrowRate: oneRay.multipliedBy(0.03).toFixed() };
  }

  return LendingRateOracleRatesCommon;
}

export function populateChainlinkAggregator() {
  // Read the references.json file
  const data = fs.readFileSync('././api3-adaptors/references.json', 'utf8');
  const config = JSON.parse(data);

  // Initialize the ChainlinkAggregator object
  const ChainlinkAggregator = {
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.buidlerevm]: {},
    [eEthereumNetwork.main]: {},
    [eEthereumNetwork.kovan]: {},
    [eEthereumNetwork.ropsten]: {},
    [eEthereumNetwork.tenderly]: {},
    [eEthereumNetwork.goerli]: {},
    [eEthereumNetwork.sepolia]: {
      USDC: config.AggregatorAdaptorUsdc,
      WETH: config.Api3AggregatorAdaptorWETH,},
    [eEthereumNetwork.custom]: {
      USDC: config.AggregatorAdaptorUsdc,
      WETH: config.Api3AggregatorAdaptorWETH,},
  };

  for (const asset of config.assets) {
    // Add the asset to the CUSTOM sepolia network in ChainlinkAggregator
    ChainlinkAggregator[eEthereumNetwork.custom][asset.assetSymbol] = asset.Api3AggregatorAdaptor;
  }

  return ChainlinkAggregator;
}

export function populateReserveAssets() {
  // Read the references.json file
  const data = fs.readFileSync('././api3-adaptors/references.json', 'utf8');
  const config = JSON.parse(data);

  // Initialize the ReserveAssets object
  const ReserveAssets = {
    [eEthereumNetwork.coverage]: {},
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.buidlerevm]: {},
    [eEthereumNetwork.main]: {},
    [eEthereumNetwork.kovan]: {},
    [eEthereumNetwork.ropsten]: {},
    [eEthereumNetwork.tenderly]: {},
    [eEthereumNetwork.goerli]: {},
    [eEthereumNetwork.sepolia]: {
      USDC: config.USDCWithFaucet,
      WETH: config.MockWETH,},
    [eEthereumNetwork.custom]: {
      USDC: config.USDCWithFaucet,
      WETH: config.WETHAddress,
    },
  };

  for (const asset of config.assets) {
    // Add the asset to the CUSTOM sepolia network in ReserveAssets
    ReserveAssets[eEthereumNetwork.custom][asset.assetSymbol] = {
      ERC20: asset.ERC20,
      Api3AggregatorAdaptor: asset.Api3AggregatorAdaptor,
    };
  }

  return ReserveAssets;
}

const LendingRateOracleRatesCommon = populateLendingRateOracleRatesCommon();
const ChainlinkAggregator = populateChainlinkAggregator();
const ReserveAssets = populateReserveAssets();

// ----------------
// PROTOCOL GLOBAL PARAMS
// ----------------

export const CommonsConfig: ICommonConfiguration = {
  MarketId: 'Commons',
  ATokenNamePrefix: 'Aave interest bearing',
  StableDebtTokenNamePrefix: 'Aave stable debt bearing',
  VariableDebtTokenNamePrefix: 'Aave variable debt bearing',
  SymbolPrefix: '',
  ProviderId: 0, // Overriden in index.ts
  OracleQuoteCurrency: 'USD',
  OracleQuoteUnit: "100000000",
  ProtocolGlobalParams: {
    TokenDistributorPercentageBase: '10000',
    MockUsdPriceInWei: '5848466240000000',
    UsdAddress: config.USDCWithFaucet,
    NilAddress: '0x0000000000000000000000000000000000000000',
    OneAddress: '0x0000000000000000000000000000000000000001',
    AaveReferral: '0',
  },

  // ----------------
  // COMMON PROTOCOL PARAMS ACROSS POOLS AND NETWORKS
  // ----------------

  Mocks: {
    AllAssetsInitialPrices: {
      ...MOCK_CHAINLINK_AGGREGATORS_PRICES,
    },
  },
  // TODO: reorg alphabetically, checking the reason of tests failing
  LendingRateOracleRatesCommon,
  // ----------------
  // COMMON PROTOCOL ADDRESSES ACROSS POOLS
  // ----------------

  // If PoolAdmin/emergencyAdmin is set, will take priority over PoolAdminIndex/emergencyAdminIndex
  PoolAdmin: {
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.buidlerevm]: undefined,
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.kovan]: undefined,
    [eEthereumNetwork.ropsten]: undefined,
    [eEthereumNetwork.main]: undefined,
    [eEthereumNetwork.tenderly]: undefined,
    [eEthereumNetwork.goerli]: undefined,
    [eEthereumNetwork.sepolia]: undefined,
    [eEthereumNetwork.custom]: undefined,
  },
  PoolAdminIndex: 0,
  EmergencyAdmin: {
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.coverage]: undefined,
    [eEthereumNetwork.buidlerevm]: undefined,
    [eEthereumNetwork.kovan]: undefined,
    [eEthereumNetwork.ropsten]: undefined,
    [eEthereumNetwork.main]: undefined,
    [eEthereumNetwork.tenderly]: undefined,
    [eEthereumNetwork.goerli]: undefined,
    [eEthereumNetwork.sepolia]: undefined,
    [eEthereumNetwork.custom]: undefined,
  },
  EmergencyAdminIndex: 1,
  ProviderRegistry: {
    [eEthereumNetwork.kovan]: '0x1E40B561EC587036f9789aF83236f057D1ed2A90',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '0x52D306e36E3B6B02c153d0266ff0f85d18BCD413',
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.tenderly]: '0x52D306e36E3B6B02c153d0266ff0f85d18BCD413',
    [eEthereumNetwork.goerli]: '',
    [eEthereumNetwork.sepolia]: '',
    [eEthereumNetwork.custom]: '',
  },
  ProviderRegistryOwner: {
    [eEthereumNetwork.kovan]: '0x85e4A467343c0dc4aDAB74Af84448D9c45D8ae6F',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '0xB9062896ec3A615a4e4444DF183F0531a77218AE',
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.tenderly]: '0xB9062896ec3A615a4e4444DF183F0531a77218AE',
    [eEthereumNetwork.goerli]: '',
    [eEthereumNetwork.sepolia]: '',
    [eEthereumNetwork.custom]: '',
  },
  LendingRateOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.kovan]: '', //'0xdCde9Bb6a49e37fA433990832AB541AE2d4FEB4a',
    [eEthereumNetwork.ropsten]: '0x05dcca805a6562c1bdd0423768754acb6993241b',
    [eEthereumNetwork.main]: '', //'0x8A32f49FFbA88aba6EFF96F45D8BD1D4b3f35c7D',
    [eEthereumNetwork.tenderly]: '0x8A32f49FFbA88aba6EFF96F45D8BD1D4b3f35c7D',
    [eEthereumNetwork.goerli]: '',
    [eEthereumNetwork.sepolia]: '',
    [eEthereumNetwork.custom]: '',
  },
  LendingPoolCollateralManager: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.kovan]: '0x9269b6453d0d75370c4c85e5a42977a53efdb72a',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '0xbd4765210d4167CE2A5b87280D9E8Ee316D5EC7C',
    [eEthereumNetwork.tenderly]: '0xbd4765210d4167CE2A5b87280D9E8Ee316D5EC7C',
    [eEthereumNetwork.goerli]: '',
    [eEthereumNetwork.sepolia]: '',
    [eEthereumNetwork.custom]: '',
  },
  LendingPoolConfigurator: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.tenderly]: '',
    [eEthereumNetwork.goerli]: '',
    [eEthereumNetwork.sepolia]: '',
    [eEthereumNetwork.custom]: '',
  },
  LendingPool: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.tenderly]: '',
    [eEthereumNetwork.goerli]: '',
    [eEthereumNetwork.sepolia]: '',
    [eEthereumNetwork.custom]: '',
  },
  WethGateway: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.tenderly]: '',
    [eEthereumNetwork.goerli]: '',
    [eEthereumNetwork.sepolia]: '',
    [eEthereumNetwork.custom]: '',
  },
  TokenDistributor: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.kovan]: '0x971efe90088f21dc6a36f610ffed77fc19710708',
    [eEthereumNetwork.ropsten]: '0xeba2ea67942b8250d870b12750b594696d02fc9c',
    [eEthereumNetwork.main]: '0xe3d9988f676457123c5fd01297605efdd0cba1ae',
    [eEthereumNetwork.tenderly]: '0xe3d9988f676457123c5fd01297605efdd0cba1ae',
    [eEthereumNetwork.goerli]: '',
    [eEthereumNetwork.sepolia]: '',
    [eEthereumNetwork.custom]: '',
  },
  AaveOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.kovan]: '', //'0xB8bE51E6563BB312Cbb2aa26e352516c25c26ac1',
    [eEthereumNetwork.ropsten]: ZERO_ADDRESS,
    [eEthereumNetwork.main]: '', //'0xA50ba011c48153De246E5192C8f9258A2ba79Ca9',
    [eEthereumNetwork.tenderly]: '0xA50ba011c48153De246E5192C8f9258A2ba79Ca9',
    [eEthereumNetwork.goerli]: '',
    [eEthereumNetwork.sepolia]: '',
    [eEthereumNetwork.custom]: '',
  },
  FallbackOracle: {
    [eEthereumNetwork.coverage]: '',
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.buidlerevm]: '',
    [eEthereumNetwork.kovan]: '0x50913E8E1c650E790F8a1E741FF9B1B1bB251dfe',
    [eEthereumNetwork.ropsten]: '0xAD1a978cdbb8175b2eaeC47B01404f8AEC5f4F0d',
    [eEthereumNetwork.main]: ZERO_ADDRESS,
    [eEthereumNetwork.tenderly]: ZERO_ADDRESS,
    [eEthereumNetwork.goerli]: '',
    [eEthereumNetwork.sepolia]: ZERO_ADDRESS,
    [eEthereumNetwork.custom]: ZERO_ADDRESS,
  },
  ChainlinkAggregator,
  ReserveAssets,
  ReservesConfig: {},
  ATokenDomainSeparator: {
    [eEthereumNetwork.coverage]:
      '0x95b73a72c6ecf4ccbbba5178800023260bad8e75cdccdb8e4827a2977a37c820',
    [eEthereumNetwork.hardhat]:
      '0xbae024d959c6a022dc5ed37294cd39c141034b2ae5f02a955cce75c930a81bf5',
    [eEthereumNetwork.buidlerevm]:
      '0xbae024d959c6a022dc5ed37294cd39c141034b2ae5f02a955cce75c930a81bf5',
    [eEthereumNetwork.kovan]: '',
    [eEthereumNetwork.ropsten]: '',
    [eEthereumNetwork.main]: '',
    [eEthereumNetwork.tenderly]: '',
    [eEthereumNetwork.goerli]: '',
    [eEthereumNetwork.sepolia]: '',
    [eEthereumNetwork.custom]: '',
  },
  WETH: {
    [eEthereumNetwork.coverage]: '', // deployed in local evm
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.buidlerevm]: '', // deployed in local evm
    [eEthereumNetwork.kovan]: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
    [eEthereumNetwork.ropsten]: '0xc778417e063141139fce010982780140aa0cd5ab',
    [eEthereumNetwork.main]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    [eEthereumNetwork.tenderly]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    [eEthereumNetwork.goerli]: '',
    [eEthereumNetwork.sepolia]: config.Api3AggregatorAdaptorWETH,
    [eEthereumNetwork.custom]: config.Api3AggregatorAdaptorWETH,
  },
  WrappedNativeToken: {
    [eEthereumNetwork.coverage]: '', // deployed in local evm
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.buidlerevm]: '', // deployed in local evm
    [eEthereumNetwork.kovan]: '0xd0a1e359811322d97991e03f863a0c30c2cf029c',
    [eEthereumNetwork.ropsten]: '0xc778417e063141139fce010982780140aa0cd5ab',
    [eEthereumNetwork.main]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    [eEthereumNetwork.tenderly]: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    [eEthereumNetwork.goerli]: '',
    [eEthereumNetwork.sepolia]: '',
    [eEthereumNetwork.custom]: '',
  },
  ReserveFactorTreasuryAddress: {
    [eEthereumNetwork.coverage]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.hardhat]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.buidlerevm]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.kovan]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.ropsten]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.main]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.tenderly]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.goerli]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.sepolia]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.custom]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
  },
  IncentivesController: {
    [eEthereumNetwork.coverage]: ZERO_ADDRESS,
    [eEthereumNetwork.hardhat]: ZERO_ADDRESS,
    [eEthereumNetwork.buidlerevm]: ZERO_ADDRESS,
    [eEthereumNetwork.kovan]: ZERO_ADDRESS,
    [eEthereumNetwork.ropsten]: ZERO_ADDRESS,
    [eEthereumNetwork.main]: ZERO_ADDRESS,
    [eEthereumNetwork.tenderly]: ZERO_ADDRESS,
    [eEthereumNetwork.goerli]: ZERO_ADDRESS,
    [eEthereumNetwork.sepolia]: ZERO_ADDRESS,
    [eEthereumNetwork.custom]: ZERO_ADDRESS,
  },
};