# AI Investment and Anti Liquidation Agent


This project utilizes a smart account or multisig to delegate an AI agent to handle funds and invest for the user. There is no scenario where you want to give an AI Agent your private keys.  Similar to the critique of the Ethereum Foundation of just "dumping ETH", the user can ask the agent to invest the tokens they want to long in their postions.  By leveraging their position, they must be aware of their health factor due to volatile market conditions.  Liquidations can happen while you sleep, so your agent can keep an eye out for your health position at all times and pull funds from the delegated smart account to repay the loan to keep your position healthy from liquidations.

This is useful for DAOs that want to invest or leverage their positions for treasury management.

**Diagram**
![Diagram](https://i.imgur.com/Eh2WkQd.jpg)


## How it Works
### Lending Folder

The lending folder consists of an aave fork that the agent will interact with to deposit and borrow assets from.  We are using custom tokens to interact with the Borrow Lending application. All contracts have been deployed to the sonic network testnet interaction.


## Smart Account Folder

Unfortunatley, Safe interfaces have limited testnet support so we decided to make our own multisig that allows delegation to a wallet.
It is deployed with a 1/1 signer that allows the AI agent wallet a certain token delegation usage per 24 hours.  Once the AI agent gives us it's wallet address, we can delegate that address.  The ideal here is to not give the AI agent unlimited acces to our funds but a set amount and certain tokens only available to them.


## Agent Folder

We use the Eliza framework to create our investment agent.
We have created custom actions to handle the needs of each step of our investment needs (such as pulling tokens from delegation, depositing on the behalf of our multisig and borrowing on our behalf).

The two main functions of the agent is to safely deposit assets and leverage our postions and to watch our health position to make sure we DO NOT get liquidated in volatile market conditions.

The actions refer to a web3.ts folder under the services folder.  It holds the functions required for the actions to take place

### The .env File
We are using contract addresses from our deployed fork of Aave with the tokens that we are mocking. (On mainnets, we would have token address for USDC, WETH and other assests)

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
