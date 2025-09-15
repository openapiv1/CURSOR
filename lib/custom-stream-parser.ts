export function parseCustomStream(value: string) {
  const lines = value.split('\n').filter(line => line.trim());
  const messages: any[] = [];
  
  for (const line of lines) {
    // Parse the numbered prefix format
    const match = line.match(/^(\d+):(.+)$/);
    if (!match) continue;
    
    const [_, type, content] = match;
    
    try {
      switch (type) {
        case '0': // Text content
          // Parse as JSON string
          const text = JSON.parse(content);
          messages.push({
            type: 'text',
            text: text
          });
          break;
          
        case '9': // Tool call
          const toolCall = JSON.parse(content);
          messages.push({
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: toolCall.toolCallId,
              toolName: toolCall.toolName,
              args: toolCall.args,
              state: 'call'
            }
          });
          break;
          
        case '10': // Tool result
          const toolResult = JSON.parse(content);
          messages.push({
            type: 'tool-result',
            toolCallId: toolResult.toolCallId,
            result: toolResult.result
          });
          break;
          
        case '2': // Image
          const imageData = JSON.parse(content);
          if (Array.isArray(imageData) && imageData[0]) {
            messages.push({
              type: 'image',
              data: imageData[0].data,
              mimeType: imageData[0].mimeType
            });
          }
          break;
          
        case 'd': // Finish reason
          const finishData = JSON.parse(content);
          messages.push({
            type: 'finish',
            finishReason: finishData.finishReason
          });
          break;
          
        case '3': // Error
          const error = JSON.parse(content);
          messages.push({
            type: 'error',
            error: error
          });
          break;
      }
    } catch (e) {
      console.error('Failed to parse stream line:', line, e);
    }
  }
  
  return messages;
}