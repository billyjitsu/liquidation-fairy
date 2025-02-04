[![License: AGPL v3](https://img.shields.io/badge/License-AGPL%20v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)
[![Build pass](https://github.com/AAVE/protocol-v2/actions/workflows/node.js.yml/badge.svg)](https://github.com/aave/protocol-v2/actions/workflows/node.js.yml)

# Aave Protocol v2 with dAPIs

This repository contains the smart contracts source code and market configuration for Aave Protocol V2. The repository uses Docker Compose and Hardhat as development environments for compilation, testing and deployment tasks.

This forked version of aave-v2 uses API3's dAPIs for data feeds for assets. Check out the [API3 Docs](https://docs.api3.org) [API3 Market](https://market.api3.org) for more information.

## What is Aave?

Aave is a decentralized non-custodial liquidity markets protocol where users can participate as depositors or borrowers. Depositors provide liquidity to the market to earn a passive income, while borrowers are able to borrow in an overcollateralized (perpetually) or undercollateralized (one-block liquidity) fashion.

## What is API3

API3 is a collaborative project to deliver traditional API services to smart contract platforms in a decentralized and trust-minimized way.

API3 is building secure first-party oracles and OEV-enabled data feeds for DeFi protocols and users. The data feeds are continuously updated by first-party oracles using signed data.

## Setup

### Installing docker and docker-compose

Follow the next steps to install `docker` and `docker-compose`:

- [Install Docker](https://docs.docker.com/get-docker/)
- [Install Docker Compose](https://docs.docker.com/compose/install/linux/#install-the-plugin-manually)

### Deploying the Aggregator Adaptors and tokens

`/api3-adaptors` contains the necessary scripts to deploy and add the API3 Aggregator Adaptors and Token contracts required for the Aave deployment on the Sepolia Testnet.

### Prerequisites

- change directory to `api3-adaptors`

    ```bash
    cd api3-adaptors
    ```

- Install all the packages

    ```bash
    yarn
    ```

- Open `config.json` and add your asset and network details. You also need proxy contract address for each asset you are going to add. Head over to the [API3 Market](https://market.api3.org) and get the proxy contract address for the assets you want to add.

    The config file should look like this:

    ```json
    {
    "assets": [
        {
            "assetName": "Wrapped Bitcoin",
            "assetSymbol": "WBTC",
            "pairName": "WBTC/USDC",
            "proxyAddress": "0xa6B2F52b35785F82875A547e8E70F86D05f02400"
        },
        ...
        // add more assets here
        ],
    // add the ETH/USD and USDC/USD proxy addresses
    "EthUsdProxyAddress": "0xa5FCEcf0B99777B04E8054845d5fEFEa95CeCE9d",
    "UsdcUsdProxyAddress": "0x995364F8AC1D76abbd48f346B4E17f1537D32B37",
    "network": {
        "chainId": 11155111,
        "name": "Sepolia",
        "rpc": "https://rpc2.sepolia.org",
        "nativeCurrency" : {
            "name": "Ether",
            "symbol": "ETH",
            "wrapped": "WETH",
            "decimals": 18
        },
        "explorerLink": "https://sepolia.etherscan.io/"
        }
    }
    ```

*NOTE: It is advisable to use a private RPC for the deployments. If the protocol deployment fails, try using another RPC.*

- Make a `.env` file and add your mnemonic in the **root** folder (check env.example). This wallet needs to be funded to cover the gas costs for the deployments.

    ```
    # Mnemonic, only first address will be used
    MNEMONIC=""
    ```

- You can now go forward and deploy the contracts.

    ```bash
    yarn deploy:adaptors
    ```

    This would deploy the Aggregator Adaptors and Token contracts for the assets you have added in the `config.json` file.

### Setting up the Aave deployer

Follow the next steps to set up the repository:

- Head back to the root directory

    ```bash
    cd ..
    ```

## Aave Markets configuration

The configurations related with the Aave Markets, assets, network details and dAPIs are located at `api3-adaptors/config.json`.

The Aave deployment uses `references.json` generated after deploying the adaptors and tokens. This file contains the addresses of the adaptors and tokens deployed.

## Deploying the Aave Protocol V2 contracts

After deploying the adaptors and tokens, you can deploy the Aave Protocol V2 contracts:

- Run the following command
```
docker-compose up
```

- Open another tab or terminal within the same directory and run the next command to connect to the container

```
docker-compose exec contracts-env bash
```

- A new Bash terminal will be prompted, connected to the container. Run the next command to deploy the Aave Protocol V2 contracts

```
yarn run aave:custom:full:migration
```

Let the script run, and the Aave Protocol V2 contracts will be deployed to the network specified in the `config.json` file.

## Spinning up the frontend

The repository contains a frontend application that interacts with the Aave Protocol V2 contracts. To start the frontend, run the next command:

```
yarn frontend:codegen
```

This command generates the necessary code for the frontend application. After that, run the next command to start the frontend:

```
yarn frontend:dev
```

## Setting up Positions on the Dapp
When you deploy the adaptor and token contracts, the tokens are minted to the deployer wallet (Wallet nemonic #0).

The distribute script will send 10% of assets to the 2nd wallet in the nemonic (Wallet nemonic #1).  Ensure to send some gas to the wallet as well.

```
yarn distribute
```
The Dapp cannot lend out USDC without having USDC in the contracts to lend out.  This deposit-USDC script will deposit USDC from the deployer wallet.

```
yarn deposit-USDC
```
User (the 2nd Wallet on the numonic), will deposit Mock API3 tokens into the Dapp.

```
yarn deposit
```
User will attempt to borrow USDC tokens now that there is a deposited position.  Can be buggy estimating gas, if it fails use the Dapp interface for full borrow.

```
yarn borrow
```
In the mock oracle, we need to set a price value tha will put a user position in a lower health position.  Update the value and run the updateMockPrice script

```
yarn updateMockPrice
```
Now we are going to switch the oracle source.  This will cause the position to be at an unhealthy borrow position.

```
yarn change-oracle
```
Now the deployer wallet, can liquidate the position since the deployer wallet has a surplus of USDC tokens to pay back the loan.

```
yarn liquidate
```

## Using Flashloans

The above scenario works in a testnet environment were we have a surplus of tokens.  In a more realistic environment, we will need to borrow assets via flashloans.

To deploy the liquidation tools.  Change the directory to aave-v2-cli-encode/api3-liquidations
        
Run the following script
```
yarn deploy:liquidations
```
Return to the root directory cd ..

In a flashloan, you request the amount you need to payback the debt but you receive the staked tokens as reward that are different from the tokens you requested for the flashloan.  So you can't pay back the flashloan.  What must be done is the tokens received must be swapped on a dex to swap back to the requested flashloan token so we can payback the loan without error.

The contracts deployed has a dex that guarantess a 10% profit on a swap to ensure that the flashloan goes through.
To deposit liquidity on the dex, run the following script

```
yarn dexDeposit
```
If you the deposit was not enough, you can add more liquidity with the following script.

```
yarn deposit-more-tokens
```

To run the flashloan to do the liquidation, run the following command.  It will calculate the position, see how much can be paid back, request the amount, liquidate, swap and pay back the loan.

```
yarn flashloanLiquidate
```

Once you are done, or if you want to deploy a new instance of the dapp.  We don't want to be bogged down with so many tokens with the same name.  This will burn all the tokens from both wallets.

```
yarn burntokens
```