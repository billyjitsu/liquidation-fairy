import TelegramClientInterface from "@elizaos/client-telegram";
import web3Service from "../services/web3.ts";
import { Action, IAgentRuntime, Memory, State } from "@elizaos/core";

export const generateWallet: Action = {
    name: "GENERATE_WALLET",
    similes: [
        "CREATE_WALLET",
        "MAKE_WALLET",
        "NEW_WALLET"
    ],
    description: "Generate a new crypto wallet",
    examples: [
        [
            {
                user: "{{user1}}",
                content: {
                    text: "I need a secure way to store my cryptocurrency",
                },
            },
            {
                user: "Eliza",
                content: {
                    text: "I'll help you generate a new crypto wallet",
                    action: "GENERATE_WALLET",
                },
            },
        ],
        [
            {
                user: "{{user1}}",
                content: {
                    text: "How do I create a wallet for my crypto?",
                },
            },
            {
                user: "Eliza",
                content: {
                    text: "Let me create a new wallet for you",
                    action: "GENERATE_WALLET",
                },
            },
        ],
    ],
    validate: async (agentRuntime: IAgentRuntime, message: Memory, state: State) => {
        return message.content.text.includes("wallet") && message.content.text.includes("generate");
    },
    handler: async (agentRuntime: IAgentRuntime, message: Memory, state: State) => {
        const wallet = await web3Service.generateNewWallet();

        console.log("[Generate Wallet] Generated wallet:", wallet);
        console.log("[Generate Wallet] Wallet address:", wallet.walletAddress);
        console.log("[Generate Wallet] Private key:", wallet.privateKey);

        agentRuntime.composeState(message, {
            walletAddress: wallet.walletAddress,
            privateKey: wallet.privateKey,
        });
    },
};