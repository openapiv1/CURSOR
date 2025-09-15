import { UIMessage } from "ai";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const ABORTED = "User aborted";

export const prunedMessages = (messages: UIMessage[]): UIMessage[] => {
  if (messages.at(-1)?.role === "assistant") {
    return messages;
  }

  return messages.map((message) => {
    // Pass through all tool results including screenshots so AI can see them
    if (message.parts) {
      message.parts = message.parts.map((part) => {
        if (part.type === "tool-invocation") {
          // Keep ALL tool results including screenshots - AI MUST see them to respond properly
          return part;
        }
        return part;
      });
    }
    return message;
  });
};
