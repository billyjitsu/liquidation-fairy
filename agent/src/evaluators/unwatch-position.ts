import openAiService from "../services/openai.ts";
import { Evaluator, State } from "@elizaos/core";
import { IAgentRuntime, Memory } from "@elizaos/core";

const unwatchPosition: Evaluator = {
    name: "UNWATCH_POSITION",
    similes: [
        "STOP_WATCHING_POSITION",
        "STOP_MONITORING_POSITION",
        "END_POSITION_TRACKING",
        "DISABLE_POSITION_MONITORING",
        "CANCEL_POSITION_WATCH",
        "REMOVE_POSITION_WATCH"
    ],
    description: "Use this evaluator when the user asks to stop watching or monitoring their wallet position. This will remove any active position monitoring and associated health threshold alerts for the specified wallet address.",
    examples: [
        {
            context: "User wants to stop position monitoring",
            messages: [
                {
                    user: "{{user1}}",
                    content: { text: "please stop watching my position for wallet 0x123456789abcdef" }
                },
                {
                    user: "Eliza",
                    content: {
                        text: "I've stopped monitoring the position for wallet 0x123456789abcdef. You will no longer receive health threshold alerts.",
                        action: "UNWATCH_POSITION"
                    }
                }
            ],
            outcome: "The agent stops monitoring the wallet position and removes associated health threshold alerts"
        },
        {
            context: "User requests to unwatch their position",
            messages: [
                {
                    user: "{{user1}}",
                    content: { text: "unwatch the position for 0xabcdef123456789" }
                },
                {
                    user: "Eliza",
                    content: {
                        text: "I've disabled position monitoring for wallet 0xabcdef123456789. Position tracking and health alerts have been turned off.",
                        action: "UNWATCH_POSITION"
                    }
                }
            ],
            outcome: "The agent disables position tracking and removes the health threshold monitoring"
        },
        {
            context: "User wants to cancel monitoring with explanation",
            messages: [
                {
                    user: "{{user1}}",
                    content: { text: "i don't need you to track my wallet position anymore" }
                },
                {
                    user: "Eliza",
                    content: {
                        text: "I understand. I've removed the position monitoring for your wallet. If you'd like to resume monitoring in the future, just let me know.",
                        action: "UNWATCH_POSITION"
                    }
                }
            ],
            outcome: "The agent acknowledges the request and removes position monitoring while informing about future options"
        }
    ],
    validate: async (_, memory: Memory, state: State) => {

        const {
            isUnwatchRequest,
            walletAddress,
        } = await openAiService.extractUnwatchPosition(memory.content.text);

        console.log("[Unwatch Position] Extracted unwatch position request:", isUnwatchRequest);
        console.log("[Unwatch Position] Wallet address:", walletAddress);

        if (!isUnwatchRequest) return false;

        state["walletAddress"] = walletAddress;

        return true;
    },
    handler: async (runtime: IAgentRuntime, memory: Memory, state: State) => {
        try {
            const walletAddress = state["walletAddress"];

            console.log("[Unwatch Position] Starting handler");
            console.log("[Unwatch Position] Wallet address:", walletAddress);

            const watchKey = `watch_${walletAddress}`;
            const existingWatch = await runtime.cacheManager.get(watchKey);

            if (!existingWatch) {
                runtime.composeState(memory, {
                    error: `No active monitoring found for wallet ${walletAddress}`
                });
                return;
            }

            await runtime.cacheManager.delete(watchKey);
            runtime.composeState(memory, {
                success: true,
                unwatchedAddress: walletAddress
            });

        } catch (error) {
            console.error("[Unwatch Position] Handler error:", error);
            runtime.composeState(memory, {
                error: "Failed to unwatch position"
            });
        }
    },
};

export default unwatchPosition;
