import { type UUID, type Character } from "@elizaos/core";

const BASE_URL = "http://localhost:3000";

const fetcher = async ({
  url,
  method,
  body,
  headers,
}: {
  url: string;
  method?: "GET" | "POST";
  body?: object | FormData;
  headers?: HeadersInit;
}) => {
  const options: RequestInit = {
    method: method ?? "GET",
    headers: headers
      ? headers
      : {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
  };

  if (method === "POST") {
    if (body instanceof FormData) {
      // @ts-expect-error - Supressing potentially undefined options header
      delete options.headers["Content-Type"];
      options.body = body;
    } else {
      options.body = JSON.stringify(body);
    }
  }

  return fetch(`${BASE_URL}${url}`, options).then(async (resp) => {
    if (resp.ok) {
      const contentType = resp.headers.get("Content-Type");

      return resp.json();
    }

    const errorText = await resp.text();
    console.error("Error: ", errorText);

    let errorMessage = "An error occurred.";
    try {
      const errorObj = JSON.parse(errorText);
      errorMessage = errorObj.message || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }

    throw new Error(errorMessage);
  });
};

export const apiClient = {
  sendMessage: (agentId: string, message: string) => {
    const formData = new FormData();
    formData.append("text", message);
    formData.append("user", "user");
    console.log(formData, "formdata");
    return fetcher({
      url: `/${agentId}/message`,
      method: "POST",
      body: formData,
    });
  },
  getAgents: () => fetcher({ url: "/agents" }),
  getAgent: (agentId: string): Promise<{ id: UUID; character: Character }> =>
    fetcher({ url: `/agents/${agentId}` }),
  whisper: async (agentId: string, audioBlob: Blob) => {
    const formData = new FormData();
    formData.append("file", audioBlob, "recording.wav");
    return fetcher({
      url: `/${agentId}/whisper`,
      method: "POST",
      body: formData,
    });
  },
};
