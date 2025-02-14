import web3Service from "../services/web3.ts";
import { Action, IAgentRuntime, Memory } from "@elizaos/core";

export const healthFactorAction: Action = {
  name: "HEALTH_FACTOR",
  similes: ["CHECK_HEALTH_FACTOR", "HEALTH_RATIO", "RISK_LEVEL"],
  description:
    "Retrieve the health factor of a lending pool for a given multisig address",
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "What is my health factor?",
        },
      },
      {
        user: "Eliza",
        content: {
          text: "Let me check your health factor.",
          action: "HEALTH_FACTOR",
        },
      },
    ],
    [
      {
        user: "{{user1}}",
        content: {
          text: "Check the health factor of my account at the lending pool",
        },
      },
      {
        user: "Eliza",
        content: {
          text: "I'll retrieve your health factor now.",
          action: "HEALTH_FACTOR",
        },
      },
    ],
  ],
  validate: async (agentRuntime: IAgentRuntime, message: Memory) => {
    return (
      message.content.text.toLowerCase().includes("health factor") ||
      message.content.text.toLowerCase().includes("risk level")
    );
  },
  handler: async (agentRuntime: IAgentRuntime, message: Memory) => {
    try {
      const lendingPoolAddress: string =
        process.env.DEFAULT_LENDING_POOL_ADDRESS || "";
      const multisigAddress: string = process.env.DEPLOYED_MULTISIG || "";

      if (!lendingPoolAddress || !multisigAddress) {
        return {
          text: "I need both the lending pool address and your multisig address to check the health factor.",
        };
      }

      const healthFactor = await web3Service.getHealthFactor(
        lendingPoolAddress,
        multisigAddress
      );

      console.log("[Get Health Factor] Retrieved health factor:", healthFactor);

      agentRuntime.composeState(message, {
        healthFactor,
      });

      return {
        text: `Your health factor is: ${healthFactor}`,
        action: "HEALTH_FACTOR",
        data: {
          healthFactor,
        },
      };
    } catch (error) {
      console.error(
        "[Get Health Factor] Error retrieving health factor:",
        error
      );
      return {
        text: "I encountered an error while retrieving your health factor. Please try again later.",
      };
    }
  },
};
