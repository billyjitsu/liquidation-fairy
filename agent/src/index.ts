import { DirectClient } from "@elizaos/client-direct";
import {
  AgentRuntime,
  elizaLogger,
  settings,
  stringToUuid,
  type Character,
} from "@elizaos/core";
import { bootstrapPlugin } from "@elizaos/plugin-bootstrap";
import { createNodePlugin } from "@elizaos/plugin-node";
import { solanaPlugin } from "@elizaos/plugin-solana";
import fs from "fs";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import { initializeDbCache } from "./cache/index.ts";
import { character } from "./character.ts";
import { startChat } from "./chat/index.ts";
import { initializeClients } from "./clients/index.ts";
import {
  getTokenForProvider,
  loadCharacters,
  parseArguments,
} from "./config/index.ts";
import { initializeDatabase } from "./database/index.ts";
import watchPosition from "./evaluators/watch-position.ts";
import unwatchPosition from "./evaluators/unwatch-position.ts";
import cron from "node-cron";
import web3Service from "./services/web3.ts";
import { generateWallet } from "./actions/generate-wallet.ts";
import { transferDelegatedTokens } from "./actions/transfer-delegated-tokens.ts";
import { borrowOnBehalf } from "./actions/borrow-on-behalf.ts";
import { depositOnBehalf } from "./actions/deposit-on-behalf.ts";
import { healthFactorAction } from "./actions/health-factor.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const wait = (minTime: number = 1000, maxTime: number = 3000) => {
  const waitTime =
    Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
  return new Promise((resolve) => setTimeout(resolve, waitTime));
};

// health factor checks
const WARNING_THRESHOLD = 1.5;
const CRITICAL_THRESHOLD = 1.1;

let activeAgentId: string | null = null;

async function sendHealthAlert(directClient: DirectClient, message: string) {
  if (!activeAgentId) {
    elizaLogger.error("No active agent ID found. Cannot send message.");
    return;
  }

  try {
    await directClient.app.post(
      `/${activeAgentId}/message`,
      async (req, res) => {
        const response = await this.handleMessage(req.body);
        res.json(response);
      }
    );

    console.log(
      `Message sent via DirectClient to agent ${activeAgentId}:`,
      message
    );
  } catch (error) {
    elizaLogger.error("Error sending health alert:", error);
  }
}

let nodePlugin: any | undefined;

export function createAgent(
  character: Character,
  db: any,
  cache: any,
  token: string
) {
  elizaLogger.success(
    elizaLogger.successesTitle,
    "Creating runtime for character",
    character.name
  );

  nodePlugin ??= createNodePlugin();

  return new AgentRuntime({
    databaseAdapter: db,
    token,
    modelProvider: character.modelProvider,
    evaluators: [watchPosition, unwatchPosition],
    character,
    plugins: [
      bootstrapPlugin,
      nodePlugin,
      character.settings?.secrets?.WALLET_PUBLIC_KEY ? solanaPlugin : null,
    ].filter(Boolean),
    providers: [],
    actions: [
      generateWallet,
      transferDelegatedTokens,
      depositOnBehalf,
      borrowOnBehalf,
      healthFactorAction,
    ],
    services: [],
    managers: [],
    cacheManager: cache,
  });
}

async function startAgent(character: Character, directClient: DirectClient) {
  try {
    character.id ??= stringToUuid(character.name);
    character.username ??= character.name;

    const token = getTokenForProvider(character.modelProvider, character);
    const dataDir = path.join(__dirname, "../data");

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const db = initializeDatabase(dataDir);

    await db.init();

    const cache = initializeDbCache(character, db);
    const runtime = createAgent(character, db, cache, token);

    await runtime.initialize();

    runtime.clients = await initializeClients(character, runtime);

    directClient.registerAgent(runtime);
    activeAgentId = runtime.agentId;

    // report to console
    elizaLogger.debug(`Started ${character.name} as ${runtime.agentId}`);

    return runtime;
  } catch (error) {
    elizaLogger.error(
      `Error starting agent for character ${character.name}:`,
      error
    );
    console.error(error);
    throw error;
  }
}

const checkPortAvailable = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      }
    });

    server.once("listening", () => {
      server.close();
      resolve(true);
    });

    server.listen(port);
  });
};

const startAgents = async () => {
  const directClient = new DirectClient();
  let serverPort = parseInt(settings.SERVER_PORT || "3000");
  const args = parseArguments();

  let charactersArg = args.characters || args.character;
  let characters = [character];

  console.log("charactersArg", charactersArg);
  if (charactersArg) {
    characters = await loadCharacters(charactersArg);
  }
  console.log("characters", characters);
  try {
    for (const character of characters) {
      await startAgent(character, directClient as DirectClient);
    }
  } catch (error) {
    elizaLogger.error("Error starting agents:", error);
  }

  while (!(await checkPortAvailable(serverPort))) {
    elizaLogger.warn(`Port ${serverPort} is in use, trying ${serverPort + 1}`);
    serverPort++;
  }

  // upload some agent functionality into directClient
  directClient.startAgent = async (character: Character) => {
    // wrap it so we don't have to inject directClient later
    return startAgent(character, directClient);
  };

  directClient.start(serverPort);

  if (serverPort !== parseInt(settings.SERVER_PORT || "3000")) {
    elizaLogger.log(`Server started on alternate port ${serverPort}`);
  }

  const isDaemonProcess = process.env.DAEMON_PROCESS === "true";
  if (!isDaemonProcess) {
    elizaLogger.log("Chat started. Type 'exit' to quit.");
    const chat = startChat(characters);
    chat();
  }

  cron.schedule("*/30 * * * * *", async () => {
    try {
      elizaLogger.log("Checking health factor...");
      const healthFactor = await web3Service.getHealthFactor(
        process.env.LENDING_POOL_ADDRESS,
        process.env.DEPLOYED_MULTISIG
      );
      const healthFactorFixed = healthFactor.toFixed(2);

      console.log("Health factor:", healthFactorFixed);
      const now = Date.now();

      if (healthFactor < CRITICAL_THRESHOLD) {
        const message = `🚨 CRITICAL ALERT: Your health factor is ${healthFactorFixed}! Immediate action required to avoid liquidation.`;
        if (message) {
          await sendHealthAlert(directClient, message);
        }

        console.log("\x1b[31m[CRITICAL]\x1b[0m");
      } else if (healthFactor < WARNING_THRESHOLD) {
        const message = `⚠️ WARNING: Your health factor is ${healthFactorFixed}. Consider adding collateral or reducing debt.`;

        console.log(directClient, "client");
        if (message) {
          await sendHealthAlert(directClient, message);
        }

        console.log("\x1b[33m[WARNING]\x1b[0m");
      } else {
        console.log("\x1b[32m[HEALTHY]\x1b[0m");
      }
    } catch (error) {
      elizaLogger.error("Error in health check:", error);
    }
  });
};

startAgents().catch((error) => {
  elizaLogger.error("Unhandled error in startAgents:", error);
  process.exit(1);
});
