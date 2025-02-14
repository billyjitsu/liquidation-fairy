import TelegramClientInterface from "@elizaos/client-telegram";
import web3Service from "../services/web3.ts";
import { Action, IAgentRuntime, Memory, State } from "@elizaos/core";

export const transferTokensOnBehalf: Action = {
  name: "SEND_TOKENS_TO_ACCOUNT",
  similes: [
    "SEND_TOKENS",
    "TRANSFER_FUNDS",
    "MOVE_TOKENS",
    "DELEGATE_TRANSFER",
    "TRANSFER_TO_MULTISIG",
    "BACK_TO_MULTISIG",
    "BACK_TO_WALLET",
    "TRANSFER_TO_WALLET",
    "BACK_TO_ACCOUNT",
  ],
  description:
    "Transfer collateral and debt tokens to a multisig wallet from the AI agent wallet after doing the requested function.  Our goal is to never hold on to the tokens for too long as they have a purpose and should be used as soon as possible.",
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "I need you to transfer the tokens you have in your wallet to my multisig wallet",
        },
      },
      {
        user: "Eliza",
        content: {
          text: "I'll help you transfer those tokens to your multisig wallet",
          action: "SEND_TOKENS_TO_ACCOUNT",
        },
      },
    ],
  ],
  validate: async (
    agentRuntime: IAgentRuntime,
    message: Memory,
    state: State
  ) => {
    const text = message.content.text.toLowerCase();
    return (
      text.includes("transfer") ||
      text.includes("send") ||
      text.includes("move") ||
      text.includes("delegate")
    );
  },
  handler: async (
    agentRuntime: IAgentRuntime,
    message: Memory,
    state: State
  ) => {
    console.log("Starting token transfer process");

    // Verify required environment variables
    const requiredEnvVars = [
      "AI_AGENT_PRIVATE_KEY",
      "DEPLOYED_MULTISIG",
      "COLLATERAL_TOKEN",
      "DEBT_TOKEN",
    ];

    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar]) {
        throw new Error(`Missing required environment variable: ${envVar}`);
      }
    }

    try {
      // Default transfer amounts - these could be made configurable
      const collateralAmount = "10";
      const debtAmount = "10";

      await web3Service.transferTokensOnBehalf(
        process.env.AI_AGENT_PRIVATE_KEY,
        process.env.DEPLOYED_MULTISIG,
        process.env.COLLATERAL_TOKEN,
        process.env.DEBT_TOKEN,
        collateralAmount,
        debtAmount
      );

      // Store transfer details in state
      agentRuntime.composeState(message, {
        lastAction: 'SEND_TOKENS_TO_ACCOUNT",',
        transferDetails: {
          multisigAddress: process.env.DEPLOYED_MULTISIG,
          collateralToken: process.env.COLLATERAL_TOKEN,
          debtToken: process.env.DEBT_TOKEN,
          collateralAmount: collateralAmount,
          debtAmount: debtAmount,
          timestamp: new Date().toISOString(),
        },
      });

      return {
        text:
          `✅ Token transfer completed successfully!\n\n` +
          `📤 Transferred:\n` +
          `- ${collateralAmount} Collateral Tokens\n` +
          `- ${debtAmount} Debt Tokens\n\n` +
          `👛 To Multisig: ${process.env.DEPLOYED_MULTISIG}\n\n` +
          `Would you like to check the new token balances?`,
        action: "SEND_TOKENS_TO_ACCOUNT",
        metadata: {
          multisigAddress: process.env.DEPLOYED_MULTISIG,
          collateralToken: process.env.COLLATERAL_TOKEN,
          debtToken: process.env.DEBT_TOKEN,
          collateralAmount: collateralAmount,
          debtAmount: debtAmount,
          timestamp: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error("Error during token transfer:", error);

      // Update state to reflect failed transfer
      agentRuntime.composeState(message, {
        lastAction: 'SEND_TOKENS_TO_ACCOUNT",_FAILED',
        error: {
          message: error.message,
          timestamp: new Date().toISOString(),
        },
      });

      return {
        text:
          `❌ Failed to transfer tokens.\n\n` +
          `Error: ${error.message}\n\n` +
          `Would you like me to try the transfer again?`,
        action: "SEND_TOKENS_TO_ACCOUNT",
        metadata: {
          error: error.message,
          timestamp: new Date().toISOString(),
        },
      };
    }
  },
};
