import TelegramClientInterface from "@elizaos/client-telegram";
import web3Service from "../services/web3.ts";
import { Action, IAgentRuntime, Memory, State } from "@elizaos/core";

export const swapTokensOnBehalf: Action = {
    name: "SWAP_TOKENS_ON_BEHALF",
    similes: ["SWAP_TOKENS", "EXCHANGE_TOKENS", "TRADE_TOKENS", "DEX_SWAP"],
    description: "Swap tokens between collateral and debt tokens using a DEX",
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I need to swap my debt tokens for collateral tokens",
                },
            },
            {
                user: "Eliza",
                content: {
                    text: "I'll help you swap your tokens using the DEX",
                    action: "SWAP_TOKENS_ON_BEHALF",
                },
            },
        ],
    ],
    validate: async (agentRuntime: IAgentRuntime, message: Memory, state: State) => {
        const text = message.content.text.toLowerCase();
        return text.includes('swap') || 
               text.includes('exchange') || 
               text.includes('trade');
    },
    handler: async (agentRuntime: IAgentRuntime, message: Memory, state: State) => {
        console.log("Starting token swap process");

        // Verify required environment variables
        const requiredEnvVars = [
            'AI_AGENT_PRIVATE_KEY',
            'COLLATERAL_TOKEN',
            'DEBT_TOKEN',
            'DEX_ADDRESS'
        ];

        for (const envVar of requiredEnvVars) {
            if (!process.env[envVar]) {
                throw new Error(`Missing required environment variable: ${envVar}`);
            }
        }

        try {
            await web3Service.swapTokensOnBehalf(
                process.env.AI_AGENT_PRIVATE_KEY,
                process.env.COLLATERAL_TOKEN,
                process.env.DEBT_TOKEN
            );

            // Store swap details in state
            agentRuntime.composeState(message, {
                lastAction: 'SWAP_TOKENS_ON_BEHALF',
                swapDetails: {
                    fromToken: process.env.COLLATERAL_TOKEN,
                    toToken: process.env.DEBT_TOKEN,
                    timestamp: new Date().toISOString(),
                    dexAddress: process.env.DEX_ADDRESS
                }
            });

            return {
                text: `✅ Token swap completed successfully!\n\n` +
                      `📤 Swapped:\n` +
                      `- Collateral Tokens → Debt Tokens\n` +
                      `🏦 DEX Address: ${process.env.DEX_ADDRESS}\n\n` +
                      `Would you like to check your new token balances?`,
                action: "SWAP_TOKENS_ON_BEHALF",
                metadata: {
                    fromToken: process.env.COLLATERAL_TOKEN,
                    toToken: process.env.DEBT_TOKEN,
                    dexAddress: process.env.DEX_ADDRESS,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error("Error during token swap:", error);
            
            // Update state to reflect failed swap
            agentRuntime.composeState(message, {
                lastAction: 'SWAP_TOKENS_ON_BEHALF_FAILED',
                error: {
                    message: error.message,
                    timestamp: new Date().toISOString()
                }
            });

            return {
                text: `❌ Failed to swap tokens.\n\n` +
                      `Error: ${error.message}\n\n` +
                      `Would you like me to try the swap again?`,
                action: "SWAP_TOKENS_ON_BEHALF_ERROR",
                metadata: {
                    error: error.message,
                    timestamp: new Date().toISOString()
                }
            };
        }
    },
};