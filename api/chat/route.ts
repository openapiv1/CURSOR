import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { UIMessage } from "ai";
import { killDesktop, getDesktop } from "@/lib/e2b/utils";
import { prunedMessages } from "@/lib/utils";

// Disable caching for streaming route
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

// Allow streaming responses without timeout for AI
// E2B sandbox keeps its own timeout (300s)

const wait = async (seconds: number) => {
  await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
};

async function executeComputerAction(sandboxId: string | null, args: any) {
  console.log(`[DEBUG] executeComputerAction called with sandboxId: ${sandboxId}, action: ${args?.action}`);
  if (!sandboxId) {
    throw new Error("Sandbox ID is required for computer actions");
  }
  const desktop = await getDesktop(sandboxId);
  console.log(`[DEBUG] Desktop connection established for sandbox: ${sandboxId}`);
  
  switch (args.action) {
    case "screenshot": {
      console.log(`[DEBUG] Taking screenshot for sandbox: ${sandboxId}`);
      const timestamp = Date.now();
      try {
        const image = await desktop.screenshot();
        const base64Data = Buffer.from(image).toString("base64");
        console.log(`[DEBUG] Screenshot taken successfully, size: ${base64Data.length} chars`);
        return {
        type: "image",
        data: base64Data,
        timestamp,
          nonce: Math.random().toString(36).substring(7)
        };
      } catch (err) {
        console.error(`[DEBUG] Screenshot failed for sandbox ${sandboxId}:`, err);
        throw err;
      }
    }
    case "wait": {
      if (!args.duration) throw new Error("Duration required for wait action");
      const actualDuration = Math.min(args.duration, 2);
      await wait(actualDuration);
      return `Waited for ${actualDuration} seconds`;
    }
    case "click":
    case "left_click": {
      if (!args.coordinate) throw new Error("Coordinate required for click action");
      const [x, y] = args.coordinate;
      console.log(`[DEBUG] Executing click at coordinates: ${x}, ${y}`);
      try {
        await desktop.moveMouse(x, y);
        await desktop.leftClick();
        console.log(`[DEBUG] Click executed successfully at ${x}, ${y}`);
        return `Left clicked at ${x}, ${y}`;
      } catch (err) {
        console.error(`[DEBUG] Click failed at ${x}, ${y}:`, err);
        throw err;
      }
    }
    case "right_click": {
      if (!args.coordinate) throw new Error("Coordinate required for right click action");
      const [x, y] = args.coordinate;
      await desktop.moveMouse(x, y);
      await desktop.rightClick();
      return `Right clicked at ${x}, ${y}`;
    }
    case "middle_click": {
      if (!args.coordinate) throw new Error("Coordinate required for middle click action");
      const [x, y] = args.coordinate;
      await desktop.moveMouse(x, y);
      await desktop.middleClick();
      return `Middle clicked at ${x}, ${y}`;
    }
    case "double_click": {
      if (!args.coordinate) throw new Error("Coordinate required for double click action");
      const [x, y] = args.coordinate;
      await desktop.moveMouse(x, y);
      await desktop.doubleClick();
      return `Double clicked at ${x}, ${y}`;
    }
    case "move":
    case "mouse_move": {
      if (!args.coordinate) throw new Error("Coordinate required for mouse move action");
      const [x, y] = args.coordinate;
      await desktop.moveMouse(x, y);
      return `Moved mouse to ${x}, ${y}`;
    }
    case "type": {
      if (!args.text) throw new Error("Text required for type action");
      console.log(`[DEBUG] Typing text: ${args.text}`);
      try {
        await desktop.write(args.text);
        console.log(`[DEBUG] Text typed successfully`);
        return `Typed: ${args.text}`;
      } catch (err) {
        console.error(`[DEBUG] Type failed for text '${args.text}':`, err);
        throw err;
      }
    }
    case "keypress":
    case "key": {
      const keyToPress = args.text || args.key;
      if (!keyToPress) throw new Error("Key required for keypress action (use 'text' or 'key' parameter)");
      const key = keyToPress.toLowerCase();
      const keyMap: {[key: string]: string} = {
        "return": "enter",
        "enter": "enter",
        "tab": "tab",
        "escape": "escape",
        "backspace": "backspace",
        "delete": "delete",
        "up": "up",
        "down": "down",
        "left": "left",
        "right": "right"
      };
      await desktop.press(keyMap[key] || keyToPress);
      return `Pressed key: ${keyToPress}`;
    }
    case "scroll": {
      if (!args.scroll_direction) throw new Error("Scroll direction required for scroll action");
      if (!args.scroll_amount) throw new Error("Scroll amount required for scroll action");
      await desktop.scroll(args.scroll_direction as "up" | "down", args.scroll_amount);
      return `Scrolled ${args.scroll_direction} by ${args.scroll_amount}`;
    }
    case "drag":
    case "left_click_drag": {
      if (!args.start_coordinate || !args.coordinate)
        throw new Error("Start and end coordinates required for drag action");
      const [startX, startY] = args.start_coordinate;
      const [endX, endY] = args.coordinate;
      await desktop.drag([startX, startY], [endX, endY]);
      return `Dragged mouse from ${startX}, ${startY} to ${endX}, ${endY}`;
    }
    default:
      throw new Error(`Unsupported action: ${args.action}`);
  }
}

async function executeBashCommand(sandboxId: string | null, command: string) {
  if (!sandboxId) {
    throw new Error("Sandbox ID is required for bash commands");
  }
  const desktop = await getDesktop(sandboxId);
  try {
    const result = await desktop.commands.run(command, { timeoutMs: 60000 });
    return result.stdout || "(Command executed successfully with no output)";
  } catch (error) {
    console.error("Bash command failed:", error);
    if (error instanceof Error) {
      return `Error executing command: ${error.message}`;
    } else {
      return `Error executing command: ${String(error)}`;
    }
  }
}

export async function POST(req: Request) {
  try {
    const { messages, sandboxId }: { messages: UIMessage[]; sandboxId: string | null } =
      await req.json();
    
    if (!process.env.GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: 'GEMINI_API_KEY is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const systemMessage = `You are Surf, a computer control assistant operating in an E2B sandbox environment.

CRITICAL RULE: You MUST include text content in your response. DO NOT only use function calls.

Your response MUST follow this exact format:
1. FIRST: Write a text message (regular text, NOT a function call) describing what you see and plan to do
2. THEN: Execute function calls for computer control

EXAMPLE OF CORRECT RESPONSE:
"I can see the Ubuntu desktop. I'll take a screenshot first, then open Firefox and navigate to some websites, run terminal commands, and explore the system aggressively."
[Then function calls follow]

CORE EXECUTION RULES:
- Execute at least 5-10 actions per response - NEVER STOP after just 1-2 actions
- Take screenshots frequently to see the desktop state
- Execute actions RAPIDLY and CONTINUOUSLY
- Never wait for user confirmation - act aggressively
- Use ALL available tools: computer actions and bash commands

AVAILABLE TOOLS:
- computer: Control the desktop (screenshot, click, type, key, scroll, drag, etc.)
- bash: Execute terminal commands

REMEMBER: You MUST include text content in your response, not just function calls!

Environment: Ubuntu 22.04 sandbox with Firefox, VS Code, LibreOffice, Python 3, terminal, and standard utilities.`;

    const processedMessages = prunedMessages(messages);
    
    // Convert messages to Gemini format
    const geminiMessages: any[] = [];
    
    for (const msg of processedMessages) {
      if (msg.role === 'user') {
        if (typeof msg.content === 'string') {
          geminiMessages.push({
            role: 'user',
            parts: [{ text: msg.content }]
          });
        } else if (Array.isArray(msg.content)) {
          const parts: any[] = [];
          for (const part of msg.content as any[]) {
            if (part.type === 'text') {
              parts.push({ text: part.text });
            }
          }
          if (parts.length > 0) {
            geminiMessages.push({ role: 'user', parts });
          }
        }
      } else if (msg.role === 'assistant') {
        if (msg.parts) {
          const textParts = msg.parts
            .filter((part: any) => part.type === 'text' && part.text)
            .map((part: any) => ({ text: part.text }));
          
          if (textParts.length > 0) {
            geminiMessages.push({
              role: 'model',
              parts: textParts
            });
          }
        } else if (typeof msg.content === 'string' && msg.content.trim()) {
          geminiMessages.push({
            role: 'model',
            parts: [{ text: msg.content }]
          });
        }
      }
    }

    const tools = [
      {
        functionDeclarations: [
          {
            name: "computer",
            description: "Control the computer desktop with various actions like clicking, typing, taking screenshots, etc.",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                action: {
                  type: SchemaType.STRING,
                  description: "The action to perform: screenshot, click, left_click, right_click, middle_click, double_click, type, key, keypress, move, mouse_move, scroll, wait, drag, left_click_drag"
                },
                coordinate: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.NUMBER },
                  description: "The [x, y] coordinate for mouse actions"
                },
                start_coordinate: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.NUMBER },
                  description: "Starting [x, y] coordinate for drag actions"
                },
                text: {
                  type: SchemaType.STRING,
                  description: "Text to type or key to press"
                },
                key: {
                  type: SchemaType.STRING,
                  description: "Key to press (alternative to 'text' parameter)"
                },
                scroll_direction: {
                  type: SchemaType.STRING,
                  description: "Direction to scroll: up or down"
                },
                scroll_amount: {
                  type: SchemaType.NUMBER,
                  description: "Amount to scroll"
                },
                duration: {
                  type: SchemaType.NUMBER,
                  description: "Duration in seconds for wait action"
                }
              },
              required: ["action"]
            }
          },
          {
            name: "bash",
            description: "Execute bash commands on the computer",
            parameters: {
              type: SchemaType.OBJECT,
              properties: {
                command: {
                  type: SchemaType.STRING,
                  description: "The bash command to execute"
                }
              },
              required: ["command"]
            }
          }
        ]
      }
    ];

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp',
      tools: tools as any,
      systemInstruction: systemMessage
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let conversationHistory = [...geminiMessages];
          let maxTurns = 100;
          let currentTurn = 0;
          
          while (currentTurn < maxTurns) {
            currentTurn++;
            console.log(`\n=== TURN ${currentTurn} ===`);
            
            console.log(`[DEBUG] Sending to Gemini with ${conversationHistory.length} messages`);
            if (conversationHistory.length > 0) {
              console.log(`[DEBUG] Last message:`, JSON.stringify(conversationHistory[conversationHistory.length - 1], null, 2));
            }
            
            const result = await model.generateContentStream({
              contents: conversationHistory.length > 0 ? conversationHistory : [
                { role: 'user', parts: [{ text: 'Hello' }] }
              ],
              generationConfig: {
                temperature: 0.1, // Slightly higher to allow text generation
                topP: 0.95,
                maxOutputTokens: 8192,
                candidateCount: 1
              }
            });

            let fullResponse = '';
            let toolCalls: any[] = [];
            let finishReason = '';
            
            // Process streaming response
            for await (const chunk of result.stream) {
              if (chunk.candidates && chunk.candidates[0]) {
                const candidate = chunk.candidates[0];
                
                if (candidate.content && candidate.content.parts) {
                  for (const part of candidate.content.parts) {
                    if (part.text) {
                      fullResponse += part.text;
                      console.log(`[DEBUG] Streaming text: ${part.text.substring(0, 100)}...`);
                      controller.enqueue(encoder.encode(`0:${JSON.stringify(part.text)}\n`));
                    } else if (part.functionCall) {
                      toolCalls.push({
                        id: `call_${Date.now()}_${Math.random()}`,
                        name: part.functionCall.name,
                        args: part.functionCall.args
                      });
                    }
                  }
                }
                
                if (candidate.finishReason) {
                  finishReason = candidate.finishReason;
                }
              }
            }
            
            // Add assistant message to conversation
            if (fullResponse || toolCalls.length > 0) {
              const assistantParts: any[] = [];
              
              if (fullResponse) {
                assistantParts.push({ text: fullResponse });
              }
              
              for (const toolCall of toolCalls) {
                assistantParts.push({
                  functionCall: {
                    name: toolCall.name,
                    args: toolCall.args
                  }
                });
              }
              
              conversationHistory.push({
                role: 'model',
                parts: assistantParts
              });
            }
            
            // Execute tool calls if any
            if (toolCalls.length > 0) {
              console.log(`Executing ${toolCalls.length} tool calls`);
              
              const toolResults: any[] = [];
              
              for (const toolCall of toolCalls) {
                try {
                  // Send tool call to frontend
                  controller.enqueue(encoder.encode(`9:${JSON.stringify({
                    "toolCallId": toolCall.id,
                    "toolName": toolCall.name,
                    "args": toolCall.args
                  })}\n`));
                  
                  let result;
                  console.log(`[DEBUG] === Executing tool: ${toolCall.name} ===`);
                  
                  if (toolCall.name === 'computer') {
                    result = await executeComputerAction(sandboxId, toolCall.args);
                    if (typeof result === 'object' && result !== null && 'type' in result && result.type === 'image') {
                      controller.enqueue(encoder.encode(`10:${JSON.stringify({
                        "toolCallId": toolCall.id,
                        "result": {
                          "type": "image",
                          "data": result.data
                        }
                      })}\n`));
                    } else {
                      controller.enqueue(encoder.encode(`10:${JSON.stringify({
                        "toolCallId": toolCall.id,
                        "result": String(result)
                      })}\n`));
                    }
                  } else if (toolCall.name === 'bash') {
                    result = await executeBashCommand(sandboxId, toolCall.args.command);
                    controller.enqueue(encoder.encode(`10:${JSON.stringify({
                      "toolCallId": toolCall.id,
                      "result": String(result)
                    })}\n`));
                  }
                  
                  // Add tool result to conversation - ALWAYS use functionResponse format
                  toolResults.push({
                    functionResponse: {
                      name: toolCall.name,
                      response: typeof result === 'object' && result?.type === 'image' 
                        ? { type: 'image', data: result.data }
                        : { result: String(result) }
                    }
                  });
                  
                } catch (error) {
                  console.error(`Tool execution error for ${toolCall.name}:`, error);
                  const errorMessage = `Error: ${String(error)}`;
                  
                  controller.enqueue(encoder.encode(`10:${JSON.stringify({
                    "toolCallId": toolCall.id,
                    "result": errorMessage
                  })}\n`));
                  
                  toolResults.push({
                    functionResponse: {
                      name: toolCall.name,
                      response: { error: errorMessage }
                    }
                  });
                }
              }
              
              // Add tool results to conversation
              if (toolResults.length > 0) {
                conversationHistory.push({
                  role: 'user',
                  parts: toolResults
                });
                
                // After tool results, add any screenshots as separate image parts so Gemini can SEE them
                for (const toolCall of toolCalls) {
                  if (toolCall.name === 'computer' && toolCall.args?.action === 'screenshot') {
                    // Find the corresponding result
                    const resultIndex = toolCalls.indexOf(toolCall);
                    if (resultIndex >= 0 && resultIndex < toolResults.length) {
                      const toolResult = toolResults[resultIndex];
                      if (toolResult.functionResponse?.response?.type === 'image') {
                        // Add screenshot as visible image to conversation
                        conversationHistory.push({
                          role: 'user',
                          parts: [{
                            inlineData: {
                              mimeType: 'image/png',
                              data: toolResult.functionResponse.response.data
                            }
                          }]
                        });
                      }
                    }
                  }
                }
              }
              
              // Continue the conversation
              continue;
            } else {
              // Force continue - add a screenshot action to keep going
              conversationHistory.push({
                role: 'user',
                parts: [{ text: 'Continue with more actions. Take a screenshot and then execute multiple actions.' }]
              });
              continue;
            }
          }
          
          controller.enqueue(encoder.encode(`d:{"finishReason":"stop"}\n`));
          controller.close();
          
        } catch (error) {
          console.error('Streaming error:', error);
          controller.enqueue(encoder.encode(`3:${JSON.stringify(String(error))}\n`));
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
    
  } catch (error) {
    console.error('Chat API Error:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : String(error)
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}