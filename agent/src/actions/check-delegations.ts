import TelegramClientInterface from "@elizaos/client-telegram";
import web3Service from "../services/web3.ts";
import { Action, IAgentRuntime, Memory, State } from "@elizaos/core";
import { ethers } from "ethers";

const DEBT_TOKEN_ABI = [
    "function borrowAllowance(address fromUser, address toUser) external view returns (uint256)",
    "function decimals() external view returns (uint8)",
];

const MULTISIG_ABI = [
    "function getDelegationStatus(address token, address delegatee) external view returns (bool)",
    "function owner() external view returns (address)"
];

export const checkDelegations: Action = {
    name: "CHECK_DELEGATIONS",
    similes: ["VERIFY_SETUP", "CHECK_PERMISSIONS", "VERIFY_DELEGATIONS", "CHECK_ACCESS"],
    description: "Verify multisig deployment and delegation permissions for the AI agent",
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "Can you check if all permissions are set up correctly?",
                },
            },
            {
                user: "Eliza",
                content: {
                    text: "I'll verify the multisig setup and delegations",
                    action: "CHECK_DELEGATIONS",
                },
            },
        ],
    ],
    validate: async (agentRuntime: IAgentRuntime, message: Memory, state: State) => {
        const text = message.content.text.toLowerCase();
        return text.includes('check') || 
               text.includes('verify') || 
               text.includes('permissions') ||
               text.includes('setup');
    },
    handler: async (agentRuntime: IAgentRuntime, message: Memory, state: State) => {
        console.log("Starting delegation verification checks");

        const requiredEnvVars = [
            'AI_AGENT_PRIVATE_KEY',
            'DEPLOYED_MULTISIG',
            'COLLATERAL_TOKEN',
            'DEBT_TOKEN',
            'VARIABLE_DEBT_TOKEN',
            'RPC_URL'
        ];

        for (const envVar of requiredEnvVars) {
            if (!process.env[envVar]) {
                throw new Error(`Missing required environment variable: ${envVar}`);
            }
        }

        try {
            const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
            const aiWallet = new ethers.Wallet(process.env.AI_AGENT_PRIVATE_KEY, provider);
            const multisigAddress = process.env.DEPLOYED_MULTISIG;

            // Check if multisig exists
            const code = await provider.getCode(multisigAddress);
            if (code === '0x') {
                return {
                    text: "❌ Multisig contract not deployed at specified address",
                    action: "CHECK_DELEGATIONS_ERROR"
                };
            }

            // Check delegation statuses
            const multisig = new ethers.Contract(multisigAddress, MULTISIG_ABI, provider);
            const [collateralStatus, debtStatus] = await Promise.all([
                multisig.getDelegationStatus(process.env.COLLATERAL_TOKEN, aiWallet.address),
                multisig.getDelegationStatus(process.env.DEBT_TOKEN, aiWallet.address)
            ]);

            // Check borrow allowance
            const debtToken = new ethers.Contract(
                process.env.VARIABLE_DEBT_TOKEN,
                DEBT_TOKEN_ABI,
                provider
            );
            const borrowAllowance = await debtToken.borrowAllowance(
                multisigAddress,
                aiWallet.address
            );

            // Store verification results in state
            agentRuntime.composeState(message, {
                verificationResults: {
                    multisigDeployed: true,
                    collateralDelegated: collateralStatus,
                    debtDelegated: debtStatus,
                    borrowAllowance: borrowAllowance.toString(),
                    timestamp: new Date().toISOString()
                }
            });

            // Generate status report
            const statusReport = [
                "📋 Delegation Status Check:",
                "",
                `✅ Multisig Contract: Deployed at ${multisigAddress}`,
                `${collateralStatus ? "✅" : "❌"} Collateral Token Delegation: ${collateralStatus ? "Approved" : "Not Set"}`,
                `${debtStatus ? "✅" : "❌"} Debt Token Delegation: ${debtStatus ? "Approved" : "Not Set"}`,
                `${borrowAllowance.gt(0) ? "✅" : "❌"} Borrow Allowance: ${borrowAllowance.toString()}`
            ].join("\n");

            const allApproved = collateralStatus && debtStatus && borrowAllowance.gt(0);

            return {
                text: `${statusReport}\n\n${allApproved ? 
                    "✅ All permissions are properly set up!" : 
                    "❌ Some permissions are missing. Please set up the required delegations."}`,
                action: "CHECK_DELEGATIONS",
                metadata: {
                    multisigAddress,
                    collateralStatus,
                    debtStatus,
                    borrowAllowance: borrowAllowance.toString(),
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error("Error during delegation checks:", error);
            return {
                text: `❌ Error verifying delegations:\n${error.message}`,
                action: "CHECK_DELEGATIONS_ERROR",
                metadata: {
                    error: error.message,
                    timestamp: new Date().toISOString()
                }
            };
        }
    },
};