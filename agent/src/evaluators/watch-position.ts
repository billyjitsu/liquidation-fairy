import openAiService from "../services/openai.ts";
import { Evaluator, State } from "@elizaos/core";
import { IAgentRuntime, Memory } from "@elizaos/core";

const watchPosition: Evaluator = {
    name: "WATCH_POSITION",
    similes: ["MONITOR_POSITION", "TRACK_POSITION"],
    description: "Use this evaluator when the user asks to monitor or watch their wallet position",
    examples: [
        {
            context: "User wants to start monitoring their wallet position",
            messages: [
                {
                    user: "{{user1}}",
                    content: { text: "please watch my position for wallet 0x123456789abcdef" }
                },
                {
                    user: "Eliza",
                    content: { text: "I'll start monitoring your position with a health threshold of 150", action: "WATCH_POSITION" }
                }
            ],
            outcome: "The agent starts monitoring the wallet position with a health threshold"
        },
        {
            context: "User requests position tracking for their wallet",
            messages: [
                {
                    user: "{{user1}}",
                    content: { text: "can you track my position for 0xabcdef123456789" }
                },
                {
                    user: "Eliza",
                    content: { text: "I'll begin tracking your position and notify you if the health drops below 150", action: "WATCH_POSITION" }
                }
            ],
            outcome: "The agent begins tracking the wallet position and sets up health threshold notifications"
        }
    ],
    validate: async (_, memory: Memory, state: State) => {
        const {
            isWatchRequest,
            walletAddress,
            healthThreshold,
        } = await openAiService.extractWatchPosition(memory.content.text);

        console.log("[Watch Position] Extracted watch position request:", isWatchRequest);

        if (!isWatchRequest) return false;

        state["walletAddress"] = walletAddress;
        state["healthThreshold"] = healthThreshold;

        return true;
    },
    handler: async (runtime: IAgentRuntime, memory: Memory, state: State) => {
        try {
            const walletAddress = state["walletAddress"];
            const healthThreshold = state["healthThreshold"];

            console.log("[Watch Position] Starting handler");
            console.log("[Watch Position] Wallet address:", walletAddress);
            console.log("[Watch Position] Health threshold:", healthThreshold);

            const watchKey = `watch_${walletAddress}`;
            const existingWatch = await runtime.cacheManager.get(watchKey);

            if (existingWatch) {
                runtime.composeState(memory, {
                    error: `Already monitoring wallet ${walletAddress}`
                });
                return;
            }

            await runtime.cacheManager.set(watchKey, {
                userId: memory.userId,
                walletAddress: walletAddress,
                healthThreshold: healthThreshold,
                lastUpdated: new Date().toISOString()
            });

        } catch (error) {
            console.error("[Watch Position] Handler error:", error);
            runtime.composeState(memory, {
                error: "Failed to set up position monitoring"
            });
        }
    },
};

export default watchPosition;