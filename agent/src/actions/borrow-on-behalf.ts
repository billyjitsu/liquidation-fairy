import TelegramClientInterface from "@elizaos/client-telegram";
import web3Service from "../services/web3.ts";
import { Action, IAgentRuntime, Memory, State } from "@elizaos/core";
import { ethers } from "ethers";

const DEBT_TOKEN_ABI = [
    "function borrowAllowance(address fromUser, address toUser) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
];

export const borrowOnBehalf: Action = {
    name: "BORROW_ON_BEHALF",
    similes: ["GO_LONG", "BORROW_STABLE", "LEVERAGE_POSITION", "BORROW_FOR_ME", "GET_LOAN"],
    description: "Now that I have collateral tokens deposited, I want to borrow stable tokens against my collateral on behalf of my contract wallet",
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Now that I have deposited collateral, I want to borrow stable tokens against it",
                },
            },
            {
                user: "Eliza",
                content: {
                    text: "I'll borrow stable tokens against your collateral. They will be sent to your contract wallet.",
                    action: "BORROW_ON_BEHALF",
                },
            },
        ],
    ],
    validate: async (agentRuntime: IAgentRuntime, message: Memory, state: State) => {
        const text = message.content.text.toLowerCase();
        
        const borrowKeywords = [
            'borrow',
            'take loan',
            'get loan',
            'leverage',
            'debt',
            'stable coins',
            'usdc',
            'go long'
        ];
        
        return borrowKeywords.some(keyword => text.includes(keyword));
    },
    handler: async (agentRuntime: IAgentRuntime, message: Memory, state: State) => {
        console.log("Starting borrow operation against deposited collateral");
        
        const requiredEnvVars = [
            'AI_AGENT_PRIVATE_KEY',
            'DEPLOYED_MULTISIG',
            'LENDING_POOL_ADDRESS',
            'COLLATERAL_TOKEN',
            'DEBT_TOKEN',
            'AAVE_ORACLE_ADDRESS',
            'PROTOCOL_DATA_PROVIDER_ADDRESS',
            'WETH_TOKEN_ADDRESS',
            'VARIABLE_DEBT_TOKEN',
            'DEX_ADDRESS',
            'RPC_URL'
        ];

        for (const envVar of requiredEnvVars) {
            if (!process.env[envVar]) {
                throw new Error(`Missing required environment variable: ${envVar}`);
            }
        }

        try {

            console.log("Borrowing stable tokens on behalf of contract wallet...");
        
            // Perform the borrow operation
            await web3Service.borrowOnBehalf(
                process.env.AI_AGENT_PRIVATE_KEY,
                process.env.DEPLOYED_MULTISIG,
                process.env.DEBT_TOKEN,
                process.env.LENDING_POOL_ADDRESS,
                process.env.COLLATERAL_TOKEN
            );

            // Store transaction details in state
            const newState = {
                lastAction: 'BORROW_ON_BEHALF',
                transactionDetails: {
                    type: 'borrow',
                    debtTokenAddress: process.env.DEBT_TOKEN,
                    variableDebtTokenAddress: process.env.VARIABLE_DEBT_TOKEN,
                    collateralTokenAddress: process.env.COLLATERAL_TOKEN,
                    multisigAddress: process.env.DEPLOYED_MULTISIG,
                    timestamp: new Date().toISOString(),
                    lendingPool: process.env.LENDING_POOL_ADDRESS
                }
            };

            agentRuntime.composeState(message, newState);

            return {
                text: `✅ Successfully borrowed stable tokens!\n\n` +
                      `📥 Transaction Details:\n` +
                      `- Borrowed maximum available USDC against your collateral\n` +
                      `- Tokens sent to your contract wallet\n\n` +
                      `🏦 Lending Pool: ${process.env.LENDING_POOL_ADDRESS}\n` +
                      `👛 Borrower Wallet: ${process.env.DEPLOYED_MULTISIG}\n\n` +
                      `Would you like me to show your updated position details?`,
                action: "BORROW_ON_BEHALF",
                metadata: {
                    debtTokenAddress: process.env.DEBT_TOKEN,
                    variableDebtToken: process.env.VARIABLE_DEBT_TOKEN,
                    lendingPool: process.env.LENDING_POOL_ADDRESS,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error("Error during borrow operation:", error);
            
            agentRuntime.composeState(message, {
                lastAction: 'BORROW_ON_BEHALF_FAILED',
                error: {
                    message: error.message,
                    timestamp: new Date().toISOString()
                }
            });

            const errorMessage = error.message.toLowerCase();
            let userMessage = '';
            
            if (errorMessage.includes('allowance') || errorMessage.includes('delegation')) {
                userMessage = `❌ Failed to borrow: No borrowing allowance set.\n\n` +
                            `Please ensure credit delegation is set up for the contract wallet.`;
            } else if (errorMessage.includes('health factor') || errorMessage.includes('ltv')) {
                userMessage = `❌ Failed to borrow: Insufficient collateral.\n\n` +
                            `Would you like me to check your maximum borrowing capacity?`;
            } else {
                userMessage = `❌ Failed to borrow tokens.\n\n` +
                            `Error: ${error.message}\n\n` +
                            `Would you like me to try the borrow again?`;
            }

            return {
                text: userMessage,
                action: "BORROW_ON_BEHALF_ERROR",
                metadata: {
                    error: error.message,
                    timestamp: new Date().toISOString()
                }
            };
        }
    },
};