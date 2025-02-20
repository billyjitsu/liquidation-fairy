import React, { useState, useRef, useEffect } from "react";
import { apiClient } from "../lib/api";

interface ChatMessage {
  text: string;
  user: "user" | "system";
  createdAt: number;
  action?: string; // optional action from agent responses
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSendMessage = async () => {
    const userMessage: ChatMessage = {
      text: input,
      user: "user",
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
            user: "system",
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
          user: "system",
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
    <div className="max-w-2xl mx-auto py-8 flex flex-col h-screen bg-gray-50 border border-gray-300 rounded-lg shadow-lg">
      <div className="flex-1 p-4 overflow-y-auto bg-white">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`mb-3 p-3 rounded-2xl max-w-[80%] break-words ${
              msg.user === "system"
                ? "bg-blue-100 self-start"
                : "bg-green-100 self-end"
            }`}
          >
            <span className="font-bold mr-2">
              {msg.user === "system" ? "Agent:" : "You:"}
            </span>
            <span>{msg.text}</span>
          </div>
        ))}
      </div>
      <form
        className="flex p-4 border-t border-gray-300 bg-gray-200"
        onSubmit={handleSubmit}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="Type your message..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        <button
          type="submit"
          className="ml-3 px-4 py-2 bg-blue-500 text-white rounded-full hover:bg-blue-600"
        >
          Send
        </button>
      </form>
    </div>
  );
}
