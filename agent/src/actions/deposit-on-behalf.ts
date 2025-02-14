import TelegramClientInterface from "@elizaos/client-telegram";
import web3Service from "../services/web3.ts";
import { Action, IAgentRuntime, Memory, State } from "@elizaos/core";
import { ethers } from "ethers";

export const depositOnBehalf: Action = {
    name: "DEPOSIT_ON_BEHALF",
    similes: ["INVEST_FOR_ME", "DEPOSIT_COLLATERAL", "DELEGATED_IN_WALLET", "DEPOSIT_FOR_ME"],
    description: "Now that I have collateral tokens in my wallet, I want to deposit them on behalf of the contract I pulled the tokens from",
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Now that you have take the collateral tokens from my account, I want you to deposit them on the behalf of my wallet",
                },
            },
            {
                user: "Eliza",
                content: {
                    text: "I found an opportunity for you to deposit your tokens and get stable tokens for you to invest in. I shall proceed with the transaction",
                    action: "DEPOSIT_ON_BEHALF",
                },
            },
        ],
    ],
    validate: async (agentRuntime: IAgentRuntime, message: Memory, state: State) => {
        const text = message.content.text.toLowerCase();
        
        // Check for deposit-related keywords
        const depositKeywords = [
            'invest',
            'deposit',
            'put in',
            'transfer in',
            'send to pool',
            'lend'
        ];
        
        return depositKeywords.some(keyword => text.includes(keyword));
    },
    handler: async (agentRuntime: IAgentRuntime, message: Memory, state: State) => {
        console.log("Starting deposit of tokens to lending dapp");
        
        // Verify all required environment variables are set
        const requiredEnvVars = [
            'AI_AGENT_PRIVATE_KEY',
            'DEPLOYED_MULTISIG', 
            'LENDING_POOL_ADDRESS',
            'COLLATERAL_TOKEN',
            'DEBT_TOKEN'
        ];

        for (const envVar of requiredEnvVars) {
            if (!process.env[envVar]) {
                throw new Error(`Missing required environment variable: ${envVar}`);
            }
        }

        try {
            // Perform the deposit
            await web3Service.depositOnBehalf(
                process.env.AI_AGENT_PRIVATE_KEY,
                process.env.DEPLOYED_MULTISIG,
                process.env.LENDING_POOL_ADDRESS,
                process.env.COLLATERAL_TOKEN,
                process.env.DEBT_TOKEN
            );

            // Store deposit transaction details in state
            const newState = {
                lastAction: 'DEPOSIT_ON_BEHALF',
                transactionDetails: {
                    type: 'deposit',
                    collateralTokenAddress: process.env.COLLATERAL_TOKEN,
                    multisigAddress: process.env.DEPLOYED_MULTISIG,
                    timestamp: new Date().toISOString(),
                    lendingPool: process.env.LENDING_POOL_ADDRESS
                }
            };

            agentRuntime.composeState(message, newState);

            return {
                text: `✅ Successfully deposited tokens into lending pool!\n\n` +
                      `📥 Deposited:\n` +
                      `- 10 Collateral Tokens\n\n` +
                      `🏦 To Lending Pool: ${process.env.LENDING_POOL_ADDRESS}\n` +
                      `👛 On behalf of: ${process.env.DEPLOYED_MULTISIG}\n\n` +
                      `Would you like me to check your current lending position?`,
                action: "DEPOSIT_ON_BEHALF",
                metadata: {
                    tokenAddress: process.env.COLLATERAL_TOKEN,
                    lendingPool: process.env.LENDING_POOL_ADDRESS,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error("Error during deposit:", error);
            
            // Update state to reflect failed deposit
            agentRuntime.composeState(message, {
                lastAction: 'DEPOSIT_ON_BEHALF_FAILED',
                error: {
                    message: error.message,
                    timestamp: new Date().toISOString()
                }
            });

            return {
                text: `❌ Failed to deposit tokens.\n\n` +
                      `Error: ${error.message}\n\n` +
                      `Would you like me to try the deposit again?`,
                action: "DEPOSIT_ON_BEHALF_ERROR",
                metadata: {
                    error: error.message,
                    timestamp: new Date().toISOString()
                }
            };
        }
    },
};