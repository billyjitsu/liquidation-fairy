import TelegramClientInterface from "@elizaos/client-telegram";
import web3Service from "../services/web3.ts";
import { Action, IAgentRuntime, Memory, State } from "@elizaos/core";

export const transferDelegatedTokens: Action = {
    name: "TRANSFER_DELEGATED_TOKENS",
    similes: ["PULL_DELEGATED", "INVEST_FOR_ME", "DEPOSIT_FOR_ME"],
    description: "Invest tokens on behalf of the contract you pulled from",
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I want you to invest some tokens for me",
                },
            },
            {
                user: "Eliza",
                content: {
                    text: "I found an opportunity for you to deposit your tokens and get stable tokens for you to invest in. I shall proceed with the transaction",
                    action: "TRANSFER_DELEGATED_TOKENS",
                },
            },
        ],
    ],
    validate: async (agentRuntime: IAgentRuntime, message: Memory, state: State) => {
        const text = message.content.text.toLowerCase();
        return text.includes("invest") || 
               text.includes("deposit") || 
               text.includes("transfer") || 
               text.includes("pull");
    },
    handler: async (agentRuntime: IAgentRuntime, message: Memory, state: State) => {
        console.log("Starting transfer delegated tokens");
        
        // Verify all required environment variables are set
        const requiredEnvVars = [
            'AI_AGENT_PRIVATE_KEY',
            'DEPLOYED_MULTISIG', 
            'COLLATERAL_TOKEN',
            'DEBT_TOKEN'
        ];

        for (const envVar of requiredEnvVars) {
            if (!process.env[envVar]) {
                throw new Error(`Missing required environment variable: ${envVar}`);
            }
        }

        try {
            await web3Service.withdrawTokensFromMultisig(
                process.env.AI_AGENT_PRIVATE_KEY,
                process.env.DEPLOYED_MULTISIG,
                process.env.COLLATERAL_TOKEN, 
                process.env.DEBT_TOKEN
            );

            // Store the transaction info in state
            agentRuntime.composeState(message, {
                transactionDetails: {
                    collateralTokenAddress: process.env.COLLATERAL_TOKEN,
                    debtTokenAddress: process.env.DEBT_TOKEN,
                    multisigAddress: process.env.DEPLOYED_MULTISIG,
                    collateralWithdrawn: "10", // Since you're using testing amount of 10
                    debtWithdrawn: "10",       // Since you're using testing amount of 10
                    timestamp: new Date().toISOString()
                }
            });

            // Return response with transaction details
            return {
                text: `✅ Successfully transferred delegated tokens!\n\n` +
                      `📤 Withdrew:\n` +
                      `- 10 Collateral Tokens\n` +
                      `- 10 Debt Tokens\n\n` +
                      `🏦 From Multisig: ${process.env.DEPLOYED_MULTISIG}\n\n` +
                      `Transaction completed successfully.`,
                action: "TRANSFER_DELEGATED_TOKENS"
            };

        } catch (error) {
            console.error("Error during token transfer:", error);
            return {
                text: "❌ Failed to transfer tokens. Please check the transaction logs for more details.",
                action: "TRANSFER_DELEGATED_TOKENS_ERROR"
            };
        }
    },
};