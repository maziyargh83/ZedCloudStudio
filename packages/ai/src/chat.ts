export interface ChatTool {type:'function';function:{name:string;description:string;parameters:Record<string,unknown>}}
export interface ChatToolCall{id:string;type:'function';function:{name:string;arguments:string}}
export interface ChatMessage{role:'system'|'user'|'assistant'|'tool';content:string|null;tool_calls?:ChatToolCall[];tool_call_id?:string}
export interface ToolChatGateway{complete(messages:ChatMessage[],tools:ChatTool[],signal:AbortSignal):Promise<ChatMessage>}
