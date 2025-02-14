import TelegramClientInterface from "@elizaos/client-telegram";
import web3Service from "../services/web3.ts";
import { Action, IAgentRuntime, Memory, State } from "@elizaos/core";

export const repayOnBehalf: Action = {
    name: "REPAY_ON_BEHALF",
    similes: ["REPAY_LOAN", "PAY_BACK_LOAN", "RETURN_DEBT", "CLEAR_DEBT", "LOW_HEALTH_FACTOR"],
    description: "Repay a loan on behalf of another borrower using delegated tokens because of low health factor",
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I want to repay my loan using the delegated tokens",
                },
            },
            {
                user: "Eliza",
                content: {
                    text: "I'll help you repay your loan using the delegated tokens",
                    action: "REPAY_ON_BEHALF",
                },
            },
        ],
    ],
    validate: async (agentRuntime: IAgentRuntime, message: Memory, state: State) => {
        const text = message.content.text.toLowerCase();
        return text.includes('repay') || 
               text.includes('pay back') || 
               text.includes('return debt') ||
               text.includes('clear debt');
    },
    handler: async (agentRuntime: IAgentRuntime, message: Memory, state: State) => {
        console.log("Starting loan repayment process");

        // Verify required environment variables
        const requiredEnvVars = [
            'AI_AGENT_PRIVATE_KEY',
            'DEPLOYED_MULTISIG',
            'DEBT_TOKEN',
            'LENDING_POOL_ADDRESS'
        ];

        for (const envVar of requiredEnvVars) {
            if (!process.env[envVar]) {
                throw new Error(`Missing required environment variable: ${envVar}`);
            }
        }

        try {
            await web3Service.repayOnBehalf(
                process.env.DEPLOYED_MULTISIG,
                process.env.AI_AGENT_PRIVATE_KEY,
                process.env.DEBT_TOKEN,
                process.env.LENDING_POOL_ADDRESS
            );

            // Store repayment details in state
            agentRuntime.composeState(message, {
                lastAction: 'REPAY_ON_BEHALF',
                repaymentDetails: {
                    borrower: process.env.DEPLOYED_MULTISIG,
                    debtToken: process.env.DEBT_TOKEN,
                    lendingPool: process.env.LENDING_POOL_ADDRESS,
                    timestamp: new Date().toISOString()
                }
            });

            return {
                text: `✅ Loan repayment completed successfully!\n\n` +
                      `💰 Repaid debt tokens to:\n` +
                      `🏦 Lending Pool: ${process.env.LENDING_POOL_ADDRESS}\n` +
                      `👛 On behalf of: ${process.env.DEPLOYED_MULTISIG}\n\n` +
                      `Would you like to check your remaining debt balance?`,
                action: "REPAY_ON_BEHALF",
                metadata: {
                    borrower: process.env.DEPLOYED_MULTISIG,
                    debtToken: process.env.DEBT_TOKEN,
                    lendingPool: process.env.LENDING_POOL_ADDRESS,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error("Error during loan repayment:", error);
            
            // Update state to reflect failed repayment
            agentRuntime.composeState(message, {
                lastAction: 'REPAY_ON_BEHALF_FAILED',
                error: {
                    message: error.message,
                    timestamp: new Date().toISOString()
                }
            });

            return {
                text: `❌ Failed to repay loan.\n\n` +
                      `Error: ${error.message}\n\n` +
                      `Would you like me to try the repayment again?`,
                action: "REPAY_ON_BEHALF_ERROR",
                metadata: {
                    error: error.message,
                    timestamp: new Date().toISOString()
                }
            };
        }
    },
};