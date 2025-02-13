import OpenAI from "openai";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

// Schema for watching a position with validation
const watchPositionSchema = z.object({
    isWatchRequest: z
        .boolean()
        .describe("Whether the user is requesting to watch a wallet address"),
    walletAddress: z
        .string()
        .describe("The wallet address to watch"),
    healthThreshold: z
        .number()
        .describe("The health threshold to watch (must be a positive integer)"),
});

// Schema for unwatching a position with validation
const unwatchPositionSchema = z.object({
    isUnwatchRequest: z
        .boolean()
        .describe("Whether the user is requesting to unwatch a wallet address"),
    walletAddress: z
        .string()
        .describe("The wallet address to unwatch"),
});

export class OpenAIService {
    private static instance: OpenAIService;
    private openai: OpenAI;

    private constructor() {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            throw new Error("OPENAI_API_KEY environment variable not set");
        }
        this.openai = new OpenAI({ apiKey });
    }

    static getInstance(): OpenAIService {
        if (!OpenAIService.instance) {
            OpenAIService.instance = new OpenAIService();
        }
        return OpenAIService.instance;
    }

    /**
     * Extracts watch position details from a user message
     * @param message - The user's message to parse
     * @returns Parsed watch position data
     * @throws Error if parsing fails
     */
    async extractWatchPosition(
        message: string
    ): Promise<z.infer<typeof watchPositionSchema>> {
        try {
            const response = await this.openai.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content:
                            "You are a helpful assistant that extracts watch position details from a user message.",
                    },
                    {
                        role: "user",
                        content: message,
                    },
                ],
                model: "gpt-4o-mini-2024-07-18",
                response_format: zodResponseFormat(
                    watchPositionSchema,
                    "watchPosition"
                ),
            });

            const parsedContent = JSON.parse(response.choices[0]?.message?.content ?? '{"isWatchRequest": false}');
            const parsed = watchPositionSchema.safeParse(parsedContent);

            if (!parsed.success) {
                throw new Error(
                    `Failed to parse watch position response: ${parsed.error.message}`
                );
            }

            return parsed.data;
        } catch (error) {
            throw new Error(
                `Error extracting watch position: ${error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    }

    /**
     * Extracts unwatch position details from a user message
     * @param message - The user's message to parse
     * @returns Parsed unwatch position data
     * @throws Error if parsing fails
     */
    async extractUnwatchPosition(
        message: string
    ): Promise<z.infer<typeof unwatchPositionSchema>> {
        try {
            const response = await this.openai.chat.completions.create({
                messages: [
                    {
                        role: "system",
                        content:
                            "You are a helpful assistant that extracts unwatch position details from a user message.",
                    },
                    { role: "user", content: message },
                ],
                model: "gpt-4o-mini-2024-07-18",
                response_format: zodResponseFormat(
                    unwatchPositionSchema,
                    "unwatchPosition"
                ),
            });

            const parsedContent = JSON.parse(response.choices[0]?.message?.content ?? '{"isUnwatchRequest": false}');
            const parsed = unwatchPositionSchema.safeParse(parsedContent);

            if (!parsed.success) {
                throw new Error(`Failed to parse unwatch position response: ${parsed.error.message}`);
            }

            return parsed.data;
        } catch (error) {
            throw new Error(
                `Error extracting unwatch position: ${error instanceof Error ? error.message : "Unknown error"
                }`
            );
        }
    }
}

export default OpenAIService.getInstance();