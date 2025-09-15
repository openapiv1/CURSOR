import { useState, useRef, useEffect } from 'react';
import { Message } from 'ai';
import { parseCustomStream } from './custom-stream-parser';
import { 
  supabase, 
  createChatSession, 
  saveMessage, 
  getSessionMessages, 
  getLatestSession,
  updateSessionSandbox 
} from './supabase';

export function useCustomChat({ 
  api, 
  body,
  onError,
  maxSteps = 30
}: {
  api: string;
  body?: any;
  onError?: (error: Error) => void;
  maxSteps?: number;
}) {
  // All hooks must be declared at the top in consistent order
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [status, setStatus] = useState<'ready' | 'streaming' | 'submitted' | 'error'>('ready');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const typewriterRef = useRef<NodeJS.Timeout | null>(null);
  const typewriterQueueRef = useRef<{messageId: string, fullText: string, currentIndex: number} | null>(null);

  // Initialize or load existing session from Supabase
  useEffect(() => {
    const initSession = async () => {
      try {
        setIsLoadingSession(true);
        
        // Try to get the latest session
        const existingSession = await getLatestSession(body?.sandboxId || null);
        
        if (existingSession) {
          setSessionId(existingSession.id);
          
          // Load messages from the existing session
          const sessionMessages = await getSessionMessages(existingSession.id);
          if (sessionMessages && sessionMessages.length > 0) {
            const formattedMessages = sessionMessages.map(msg => ({
              id: msg.id,
              role: msg.role as 'user' | 'assistant' | 'system',
              content: msg.content?.text || msg.content || '',
              parts: msg.parts || (msg.content ? [{ type: 'text', text: msg.content }] : [])
            } as Message));
            setMessages(formattedMessages);
          }
        } else {
          // Create a new session
          const newSession = await createChatSession(body?.sandboxId || null);
          setSessionId(newSession.id);
        }
      } catch (error) {
        console.error('Failed to initialize session:', error);
        // Continue without Supabase if there's an error
      } finally {
        setIsLoadingSession(false);
      }
    };
    
    initSession();
  }, [body?.sandboxId]);

  // Update session sandbox ID when it changes
  useEffect(() => {
    const updateSandbox = async () => {
      if (sessionId && body?.sandboxId) {
        try {
          await updateSessionSandbox(sessionId, body.sandboxId);
        } catch (error) {
          console.error('Failed to update session sandbox:', error);
        }
      }
    };
    
    updateSandbox();
  }, [sessionId, body?.sandboxId]);

  // Cleanup typewriter on unmount
  useEffect(() => {
    return () => {
      clearTypewriter();
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const clearTypewriter = () => {
    if (typewriterRef.current) {
      clearInterval(typewriterRef.current);
      typewriterRef.current = null;
    }
  };

  const updateTypewriterText = (messageId: string, newFullText: string) => {
    if (typewriterQueueRef.current && typewriterQueueRef.current.messageId === messageId) {
      typewriterQueueRef.current.fullText = newFullText;
    } else {
      startTypewriter(messageId, newFullText);
    }
  };

  const startTypewriter = (messageId: string, fullText: string) => {
    clearTypewriter();
    typewriterQueueRef.current = { messageId, fullText, currentIndex: 0 };
    
    typewriterRef.current = setInterval(() => {
      const queue = typewriterQueueRef.current;
      if (!queue) return;
      
      const { messageId, fullText, currentIndex } = queue;
      
      if (currentIndex >= fullText.length) {
        // Don't clear if text is still streaming, just pause
        return;
      }
      
      const currentText = fullText.substring(0, currentIndex + 1);
      
      setMessages(currentMessages => {
        return currentMessages.map(msg => {
          if (msg.id === messageId) {
            const updatedParts = [...(msg.parts || [])];
            const textPartIndex = updatedParts.findIndex(p => p.type === 'text');
            if (textPartIndex >= 0) {
              updatedParts[textPartIndex] = { type: 'text', text: currentText };
            }
            return {
              ...msg,
              content: currentText,
              parts: updatedParts
            };
          }
          return msg;
        });
      });
      
      if (typewriterQueueRef.current) {
        typewriterQueueRef.current.currentIndex++;
      }
    }, 20); // 20ms delay between characters (50 characters per second)
  };

  const stop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    clearTypewriter();
    setStatus('ready');
  };

  const append = async (message: { role: string; content: string }) => {
    const newMessageId = Date.now().toString();
    const newMessage = { 
      id: newMessageId,
      role: message.role,
      content: message.content,
      parts: [{
        type: 'text',
        text: message.content
      }]
    } as Message;
    
    const newMessages = [...messages, newMessage];
    setMessages(newMessages);
    
    // Save message to Supabase
    if (sessionId) {
      try {
        await saveMessage(sessionId, newMessage);
      } catch (error) {
        console.error('Failed to save message to Supabase:', error);
        // Continue even if saving fails
      }
    }
    setStatus('streaming');
    
    try {
      abortControllerRef.current = new AbortController();
      
      const response = await fetch(api, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: newMessages,
          sandboxId: body?.sandboxId || null,
          ...body
        }),
        signal: abortControllerRef.current.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error('No response body');
      }

      let buffer = '';
      const assistantMessageId = Date.now().toString() + '-assistant';
      let assistantParts: any[] = [];
      let currentToolCalls = new Map();
      let accumulatedText = '';
      let isTypewriterActive = false;
      let assistantMessageCreated = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;
          
          const match = line.match(/^(\d+):(.+)$/);
          if (!match) continue;
          
          const [_, type, content] = match;
          
          try {
            switch (type) {
              case '0': // Text content
                const text = JSON.parse(content);
                accumulatedText += text;
                
                // Create initial assistant message if not created yet
                if (!assistantMessageCreated) {
                  const initialMessage = {
                    id: assistantMessageId,
                    role: 'assistant',
                    content: '',
                    parts: [{ type: 'text', text: '' }]
                  } as Message;
                  setMessages([...newMessages, initialMessage]);
                  assistantMessageCreated = true;
                  
                  // Save initial assistant message to Supabase
                  if (sessionId) {
                    saveMessage(sessionId, initialMessage).catch(err => 
                      console.error('Failed to save assistant message:', err)
                    );
                  }
                }
                
                // Find or create text part
                let textPart = assistantParts.find(p => p.type === 'text');
                if (!textPart) {
                  textPart = { type: 'text', text: '' };
                  assistantParts.push(textPart);
                }
                
                // Start or update typewriter effect
                if (!isTypewriterActive && accumulatedText.length > 0) {
                  isTypewriterActive = true;
                  startTypewriter(assistantMessageId, accumulatedText);
                } else if (isTypewriterActive) {
                  updateTypewriterText(assistantMessageId, accumulatedText);
                }
                break;
                
              case '9': // Tool call
                const toolCall = JSON.parse(content);
                const toolPart = {
                  type: 'tool-invocation',
                  toolInvocation: {
                    toolCallId: toolCall.toolCallId,
                    toolName: toolCall.toolName,
                    args: toolCall.args,
                    state: 'call'
                  }
                };
                assistantParts.push(toolPart);
                currentToolCalls.set(toolCall.toolCallId, assistantParts.length - 1);
                break;
                
              case '10': // Tool result
                const toolResult = JSON.parse(content);
                const toolIndex = currentToolCalls.get(toolResult.toolCallId);
                if (toolIndex !== undefined && assistantParts[toolIndex]) {
                  // Update tool invocation state and result
                  const toolPart = assistantParts[toolIndex];
                  if (toolPart.type === 'tool-invocation') {
                    toolPart.toolInvocation.state = 'result';
                    if (toolResult.result && typeof toolResult.result === 'object' && 
                        'type' in toolResult.result && toolResult.result.type === 'image') {
                      toolPart.toolInvocation.result = {
                        type: 'image',
                        data: toolResult.result.data
                      };
                    } else {
                      toolPart.toolInvocation.result = toolResult.result;
                    }
                  }
                }
                break;
                
              case 'd': // Finish reason
                // Stream finished - ensure typewriter completes
                if (typewriterQueueRef.current && accumulatedText) {
                  typewriterQueueRef.current.fullText = accumulatedText;
                }
                break;
                
              case '3': // Error
                const error = JSON.parse(content);
                throw new Error(error);
            }
          } catch (e) {
            console.error('Failed to parse stream line:', line, e);
          }
          
          // Update messages with current assistant parts (only for non-text parts)
          if (assistantMessageCreated && assistantParts.some(p => p.type !== 'text')) {
            setMessages(currentMessages => {
              return currentMessages.map(msg => {
                if (msg.id === assistantMessageId) {
                  return {
                    ...msg,
                    parts: [...assistantParts]
                  };
                }
                return msg;
              });
            });
          }
        }
      }

      setStatus('ready');
      
      // Save final assistant message state to Supabase
      if (sessionId && assistantMessageCreated) {
        const finalMessage = {
          id: assistantMessageId,
          role: 'assistant',
          content: accumulatedText,
          parts: assistantParts
        };
        saveMessage(sessionId, finalMessage).catch(err => 
          console.error('Failed to save final assistant message:', err)
        );
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Aborted by user
        setStatus('ready');
      } else {
        setStatus('error');
        if (onError) {
          onError(error as Error);
        }
      }
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (input.trim()) {
      append({ role: 'user', content: input });
      setInput('');
    }
  };

  return {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    status,
    stop,
    append,
    setMessages,
    setInput,
    isLoadingSession,
    sessionId
  };
}