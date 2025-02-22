import React, { useState, useRef, useEffect } from "react";
import { apiClient } from "@/lib/api";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface ChatMessage {
  text: string;
  role: "user" | "system";
  createdAt: number;
  action?: string; // optional action from agent responses
}

export default function Chat2Page() {
  const [input, setInput] = useState<string>("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      text: "Hi, how can I help you today?",
      role: "system",
      createdAt: Date.now(),
    },
    {
      text: "I'm having trouble with my account.",
      role: "user",
      createdAt: Date.now(),
    },
    {
      text: "What seems to be the problem?",
      role: "system",
      createdAt: Date.now(),
    },
  ]);
  const inputRef = useRef<HTMLInputElement>(null);

  const inputLength = input.trim().length;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSendMessage = async () => {
    const userMessage: ChatMessage = {
      text: input,
      role: "user",
      createdAt: Date.now(),
    };
    setMessages((prev) => [...prev, userMessage]);

    const agents = await apiClient.getAgents();
    const agentId = agents.agents?.[0]?.id;

    try {
      // send the message to the backend.
      const response = await apiClient.sendMessage(agentId, input);
      console.log(response, "resp");

      if (Array.isArray(response)) {
        response.forEach((msg: any) => {
          const systemMessage: ChatMessage = {
            text: msg.text || "No reply received",
            role: "system",
            createdAt: Date.now(),
            action: msg.action,
          };
          setMessages((prev) => [...prev, systemMessage]);

          // if (msg.action === "CREATE_MULTISIG") {
          //   handleDeploy();
          // }
        });
      } else {
        const systemMessage: ChatMessage = {
          text: response.reply || "No reply received",
          role: "system",
          createdAt: Date.now(),
          action: response.action,
        };
        setMessages((prev) => [...prev, systemMessage]);
      }
    } catch (error) {
      console.error("Error sending message:", error);
    }

    setInput("");
    inputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!input.trim()) return;
    handleSendMessage();
  };

  return (
    <>
      <Card className="h-full flex flex-col">
        <CardHeader className="flex flex-row items-center">
          <div className="flex items-center space-x-4">
            <div className="text-lg font-bold">Liquidation Fairy Chat</div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto">
          <div className="space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex w-fit max-w-[75%] flex-col gap-2 rounded-lg px-3 py-2 text-sm overflow-hidden",
                  message.role === "user"
                    ? "ml-auto bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <div className="overflow-wrap-anywhere">{message.text}</div>
              </div>
            ))}
          </div>
        </CardContent>
        <CardFooter>
          <form
            onSubmit={handleSubmit}
            className="flex w-full items-center space-x-2"
          >
            <Input
              id="message"
              placeholder="Type your message..."
              className="flex-1"
              autoComplete="off"
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            <Button type="submit" size="icon" disabled={inputLength === 0}>
              <Send />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </CardFooter>
      </Card>
    </>
  );
}
