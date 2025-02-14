# AI Investment and Anti-Liquidation Agent

This project utilizes a smart account or multisig to delegate an AI agent to manage funds and invest on behalf of the user. Since sharing private keys with an AI agent is not advisable, this system ensures security by allowing users to grant controlled permissions for specific tokens through a delegated smart account. The AI agent continuously monitors market conditions, ensuring leveraged positions remain healthy by automatically repaying loans when necessary to prevent liquidation, even while the user is offline.

Users must remain aware of their health factor due to market volatility. Liquidations can occur due to market volatility, but the AI agent mitigates this risk by proactively managing the user’s position, withdrawing funds from the delegated smart account when needed to maintain a stable investment.

Inspired by critiques of indiscriminate asset liquidation strategies, such as Ethereum Foundation's handling of ETH sales, this system allows users to take a more strategic approach. The AI agent can reinvest tokens into long-term positions rather than simply liquidating them. This setup is particularly useful for DAOs managing treasuries and individuals looking to automate investment strategies while retaining full custody of their funds.

**Diagram**
![Diagram](https://i.imgur.com/Eh2WkQd.jpg)

### Why Use an AI Agent for Investing?

Managing leveraged positions in volatile market conditions requires constant monitoring. Liquidations can occur at any time, including while you sleep. The AI agent:

- Monitors market conditions in real-time.
- Ensures leveraged positions remain healthy.
- Automatically repays loans if necessary to prevent liquidation.
- Executes transactions only within predefined allowances set by the user.

By utilizing this system, users maintain control over their funds while benefiting from automated investment strategies. This setup is particularly valuable for DAOs managing treasuries and individuals looking to optimize their investments without direct hands-on involvement.

## How it Works

1. **Delegation Setup**: The user deploys a smart account or multisig and sets an allowance for the AI agent.
2. **Investment Execution**: The agent can deposit, borrow, and swap tokens based on user-defined strategies.
3. **Risk Management**: The agent continuously monitors the health factor of positions and proactively prevents liquidation.

### Strategic Investment Approach

Users can instruct the AI agent to reinvest their assets rather than simply selling, aligning with long-term growth strategies. This approach is akin to structured treasury management in DAOs, ensuring efficient capital allocation while mitigating risks.

With this automated system, users and organizations can enhance their investment strategies while maintaining full custody over their assets, ensuring security and efficiency.

### Lending Folder

The lending folder consists of an aave fork that the agent will interact with to deposit and borrow assets from. We are using custom tokens to interact with the Borrow Lending application. All contracts have been deployed to the sonic network testnet interaction.

## Smart Account Folder

Unfortunately, Safe interfaces have limited testnet support so we decided to make our own multisig that allows delegation to a wallet on sonic testnet.
It is deployed with a 1/1 signer that allows the AI agent wallet a certain token delegation usage per each 24 hour period. Once the AI agent provides its wallet address, we can delegate permissions to it. The ideal here is to not give the AI agent unlimited acces to our funds but a set amount and certain tokens only available to them, allowing the user to retain control over their funds while enabling the AI agent to execute only approved actions.

## Agent Folder

We use the Eliza framework to create our investment agent.
We have created custom actions to handle the needs of each step of our investment needs (such as pulling tokens from delegation, depositing on the behalf of our multisig and borrowing on our behalf).

The two main functions of the agent is to safely deposit assets and leverage our positions and to watch our health position to make sure we DO NOT get liquidated in volatile market conditions.

The actions refer to a web3.ts folder under the services folder. It holds the functions required for the actions to take place

## The .env File

We are using contract addresses from our deployed fork of Aave with the tokens that we are mocking. (On mainnets, we would have token address for USDC, WETH and other assets). Ensure that your .env file is kept secure and never shared, as it contains sensitive wallet information.

- PRIVATE_KEY="Your Private Key"
- AI_AGENT_PRIVATE_KEY="AI Agent will give this to you"
- AI_AGENT_PUBLIC_ADDRESS="AI Agent will give this to you"
- RPC_URL="https://rpc.blaze.soniclabs.com"
- LENDING_POOL_ADDRESS="0xbeFD9E59982af4aD7f335CDA7bebF08C9ac74862"
- COLLATERAL_TOKEN="0x1afBD344C4eBFD0671EAdC1eAeF25DA4De61b3EE"
- DEBT_TOKEN="0x289138602a9C41a176EfBb7e8EE62D9942dF0D0F"
- AAVE_ORACLE_ADDRESS="0x0fb45151394Fd241696Db30F33a44bCBBC605F9f"
- PROTOCOL_DATA_PROVIDER_ADDRESS="0xCe13329a7caCD3deA3d9D6F9491E8b0a7870B84b"
- DEPLOYED_MULTISIG="0x9c316dD9c4D024930bA2Fd0Fc84D92Bb4502552F"
- WETH_TOKEN_ADDRESS="0xA0227DA17f6eFcc136D17479b55c564A54F4f8d1"
- VARIABLE_DEBT_TOKEN="0xDBC8370B7bf5aCab88d6E39DD38Bcd57535D53a8"
- DEX_ADDRESS="0x3E1c68A13839d6f77cc49AEd7D1E2E91f5bE0A22"


### AI agent transactions:
https://testnet.sonicscan.org/address/0x62394a362ba1BbD5125dD39e42bEa8B984b303B8