import TelegramClientInterface from "@elizaos/client-telegram";
import web3Service from "../services/web3.ts";
import { Action, IAgentRuntime, Memory, State } from "@elizaos/core";
import { ethers } from "ethers";

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

        const requiredEnvVars = [
            'AI_AGENT_PRIVATE_KEY',
            'DEPLOYED_MULTISIG',
            'DEBT_TOKEN',
            'COLLATERAL_TOKEN',
            'LENDING_POOL_ADDRESS'
        ];

        for (const envVar of requiredEnvVars) {
            if (!process.env[envVar]) {
                throw new Error(`Missing required environment variable: ${envVar}`);
            }
        }

        try {
            const MINIMUM_REPAY_AMOUNT = ethers.parseUnits("50", 6); // 50 USDC
            
            // Check current debt token balance
            const debtTokenBalance = await web3Service.checkTokenBalance(
                process.env.DEBT_TOKEN,
                process.env.AI_AGENT_PUBLIC_ADDRESS
            );

            console.log(`Current debt token balance: ${debtTokenBalance.formattedBalance}`);

            if (debtTokenBalance.rawBalance >= MINIMUM_REPAY_AMOUNT) {
                // Direct repayment if we have enough debt tokens
                console.log("Sufficient debt tokens found, proceeding with direct repayment...");
                await web3Service.repayOnBehalf(
                    process.env.DEPLOYED_MULTISIG,
                    process.env.AI_AGENT_PRIVATE_KEY,
                    process.env.DEBT_TOKEN,
                    process.env.LENDING_POOL_ADDRESS
                );
            } else {
                // Need to swap for more debt tokens
                console.log("Insufficient debt tokens, checking collateral balance...");
                
                const collateralBalance = await web3Service.checkTokenBalance(
                    process.env.COLLATERAL_TOKEN,
                    process.env.AI_AGENT_PUBLIC_ADDRESS
                );

                if (collateralBalance.rawBalance > 0) {
                    // Swap collateral for debt tokens
                    console.log("Swapping collateral tokens for debt tokens...");
                    await web3Service.swapTokensOnBehalf(
                        process.env.AI_AGENT_PRIVATE_KEY,
                        process.env.DEBT_TOKEN,  // from debt token
                        process.env.COLLATERAL_TOKEN  // to collateral token
                    );

                    // Proceed with repayment
                    await web3Service.repayOnBehalf(
                        process.env.DEPLOYED_MULTISIG,
                        process.env.AI_AGENT_PRIVATE_KEY,
                        process.env.DEBT_TOKEN,
                        process.env.LENDING_POOL_ADDRESS
                    );
                } else {
                    // Pull tokens from multisig if no local tokens available
                    console.log("No local tokens available, pulling from multisig...");
                    await web3Service.withdrawTokensFromMultisig(
                        process.env.AI_AGENT_PRIVATE_KEY,
                        process.env.DEPLOYED_MULTISIG,
                        process.env.COLLATERAL_TOKEN,
                        process.env.DEBT_TOKEN
                    );

                    // Then swap and repay
                    await web3Service.swapTokensOnBehalf(
                        process.env.AI_AGENT_PRIVATE_KEY,
                        process.env.DEBT_TOKEN,
                        process.env.COLLATERAL_TOKEN
                    );

                    await web3Service.repayOnBehalf(
                        process.env.DEPLOYED_MULTISIG,
                        process.env.AI_AGENT_PRIVATE_KEY,
                        process.env.DEBT_TOKEN,
                        process.env.LENDING_POOL_ADDRESS
                    );
                }
            }

            return {
                text: `✅ Repayment completed successfully!\n\n` +
                      `${debtTokenBalance.rawBalance >= MINIMUM_REPAY_AMOUNT ? 
                        '💰 Direct repayment with existing debt tokens\n' :
                        '🔄 Performed token swap before repayment\n'
                      }` +
                      `🏦 Lending Pool: ${process.env.LENDING_POOL_ADDRESS}\n` +
                      `👛 On behalf of: ${process.env.DEPLOYED_MULTISIG}`,
                action: "REPAY_ON_BEHALF"
            };
        } catch (error) {
            console.error("Error during repayment process:", error);
            return {
                text: `❌ Operation failed.\n\n` +
                      `Error: ${error.message}\n\n` +
                      `Would you like me to try again?`,
                action: "REPAY_ON_BEHALF_ERROR"
            };
        }
    },
};