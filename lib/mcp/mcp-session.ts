import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Client as MCPClient } from '@modelcontextprotocol/sdk/client/index.js';
import { type ToolSet, tool, jsonSchema } from 'ai';
import { extractJsonFromErrorString } from './extract-error-from-mcp-error';
import { MCP_ERROR_CODES } from './constants';

type CallToolResult = any;

interface ToolExecutionOptions {
  timeout?: number;
  abortSignal?: AbortSignal;
}

interface MCPSessionConfig {
  mcpBaseUrl: string;
  userId: string;
  chatId: string;
  sessionId?: string;
  token: string;
  mode: 'dynamic' | 'static';
  apps?: string[];
}

export class MCPSessionManager {
  private serverUrl: string;
  private client: MCPClient | null = null;
  private toolsCache: ToolSet | null = null;
  private connectionPromise: Promise<void> | null = null;
  private sessionId: string | undefined;
  private chatId: string;
  private token: string;
  private mode: MCPSessionConfig['mode'];
  private apps: string[] | undefined;

  constructor(config: MCPSessionConfig) {
    console.log(`Using ${config.mcpBaseUrl} as the MCP Server.`);
    this.serverUrl = `${config.mcpBaseUrl}`;
    this.sessionId = config.sessionId;
    this.chatId = config.chatId;
    this.token = config.token;
    this.mode = config.mode;
    this.apps = config.apps;
    console.log(
      `Creating MCP Session: ${this.serverUrl} chatId=${this.chatId} sessionId=${this.sessionId} apps=${this.apps?.join(',') || 'none'}`,
    );
  }

  /**
   * Connects to the MCP Streamable HTTP endpoint and initializes the session
   */
  public async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = new Promise((resolve, reject) => {
      (async () => {
        try {
          const url = new URL(this.serverUrl);
          url.searchParams.set('mode', this.mode);
          if (this.apps && this.apps.length > 0) {
            url.searchParams.set('apps', this.apps.join(','));
          }

          const transport = new StreamableHTTPClientTransport(url, {
            sessionId: this.sessionId,
            requestInit: {
              headers: {
                'x-chat-id': this.chatId,
                Authorization: `Bearer ${this.token}`,
              },
            } as RequestInit,
          });

          this.client = new MCPClient(
            {
              name: 'Membrane MCP Client',
              version: '1.0.0',
            },
            {
              capabilities: {},
            },
          );

          // Initialize the connection
          await this.client.connect(transport);
          this.sessionId = transport.sessionId;

          resolve();
        } catch (error) {
          console.error('MCP connection error:', error);
          this.close();
          reject(new Error('Failed to establish MCP connection'));
        }
      })();
    });

    return this.connectionPromise;
  }

  /**
   * Disconnects from the MCP endpoint
   */
  public close(): void {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
    this.connectionPromise = null;
    this.toolsCache = null;
  }

  /**
   * Fetches the available tools from the MCP server
   * @returns A record of tool objects with execute methods
   */
  public async tools({ useCache }: { useCache: boolean }): Promise<ToolSet> {
    // Ensure we're connected first
    await this.connect();

    if (!this.client) {
      throw new Error('MCP client not initialized');
    }

    if (useCache && this.toolsCache) {
      console.log('Returning cached tools');
      return this.toolsCache;
    }

    let mcpTools = {} as Awaited<
      ReturnType<NonNullable<MCPSessionManager['client']>['listTools']>
    >['tools'];

    try {
      const toolsResponse = await this.client.listTools();
      mcpTools = toolsResponse.tools;
      console.log(
        `Successfully fetched ${Object.keys(mcpTools).length} tools from MCP server`,
      );
    } catch (error) {
      const errorJson = extractJsonFromErrorString(String(error));

      if (!errorJson) {
        console.warn(
          "Couldn't parse error response, attempting retry without session ID...",
        );
      } else {
        const shouldRetryWithoutSessionId =
          errorJson?.error?.code === MCP_ERROR_CODES.INVALID_SESSION_ID;

        if (shouldRetryWithoutSessionId) {
          console.log('Invalid session ID, retrying without session ID...');
          await this.retryWithoutSessionId();

          if (!this.client) {
            throw new Error('MCP client not initialized after retry');
          }
          const toolsResponse = await this.client.listTools();
          mcpTools = toolsResponse.tools;
        }
      }
    }

    const executableTools = this.convertTools(mcpTools);

    this.toolsCache = executableTools;
    return executableTools;
  }

  /**
   * Converts MCP SDK tools to the expected format with execute methods
   */
  private convertTools(
    mcpTools: Awaited<
      ReturnType<NonNullable<MCPSessionManager['client']>['listTools']>
    >['tools'],
  ): ToolSet {
    const tools: ToolSet = {};

    for (const mcpTool of Object.values(mcpTools)) {
      try {
        if (!mcpTool.name) {
          console.warn('Skipping tool without name');
          continue;
        }

        if (!mcpTool.inputSchema) {
          console.warn(`Skipping tool '${mcpTool.name}' without input schema`);
          continue;
        }

        tools[mcpTool.name] = tool({
          description: mcpTool.description || '',
          parameters: jsonSchema(mcpTool.inputSchema),
          execute: async (args: unknown, options: ToolExecutionOptions) => {
            return this.executeTool(mcpTool.name, args, {
              timeout: 180_000, // 3 minutes
              ...options,
            });
          },
        });

        console.log(`Converted tool: ${mcpTool.name}`);
      } catch (error) {
        console.error(`Failed to convert tool '${mcpTool.name}':`, error);
        // Continue with other tools instead of failing completely
      }
    }

    return tools;
  }

  /**
   * Executes a tool with the given arguments
   */
  private async executeTool(
    name: string,
    args: unknown,
    options: ToolExecutionOptions,
  ): Promise<CallToolResult> {
    if (!this.client) {
      throw new Error('MCP client not initialized');
    }

    console.log(`Executing tool: ${name} with args:`, args);

    const abortController = options.abortSignal
      ? new AbortController()
      : new AbortController();

    // Link the provided abort signal to our controller if one was provided
    if (options.abortSignal) {
      options.abortSignal.addEventListener('abort', () => {
        abortController.abort();
      });
    }

    // Set up timeout if specified
    let timeoutId: NodeJS.Timeout | null = null;
    if (options.timeout) {
      timeoutId = setTimeout(() => {
        abortController.abort();
      }, options.timeout);
    }

    try {
      // Execute the tool using the SDK
      const result = await this.client.callTool({
        name,
        arguments: args as Record<string, unknown>,
      });

      // Clear timeout if it was set
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      console.log(`Tool '${name}' executed successfully`);
      
      // Truncate large results to prevent token overflow
      return this.truncateLargeResult(result, name);
    } catch (error) {
      // Clear timeout if it was set
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      if (abortController.signal.aborted) {
        throw new Error(`Tool '${name}' execution aborted or timed out`);
      }

      console.error(`Tool '${name}' execution failed:`, error);
      throw new Error(`Tool '${name}' execution failed: ${String(error)}`);
    }
  }

  /**
   * Truncate large tool results to prevent token overflow
   */
  private truncateLargeResult(result: any, toolName: string): any {
    const resultString = JSON.stringify(result);
    const resultSizeKB = resultString.length / 1024;
    const estimatedTokens = Math.ceil(resultString.length / 4);
    
    // Limit: 50KB (~12,500 tokens) - safe for context window
    const MAX_SIZE_KB = 50;
    const MAX_SIZE_BYTES = MAX_SIZE_KB * 1024;
    
    if (resultString.length <= MAX_SIZE_BYTES) {
      // Result is small enough, return as-is
      return result;
    }
    
    // Result is too large, truncate it
    console.warn(`\n⚠️  LARGE TOOL RESULT DETECTED!`);
    console.warn(`Tool: ${toolName}`);
    console.warn(`Size: ${resultSizeKB.toFixed(2)} KB (~${estimatedTokens.toLocaleString()} tokens)`);
    console.warn(`Limit: ${MAX_SIZE_KB} KB - Truncating to prevent context overflow...\n`);
    
    // Handle MCP-style results with content array
    if (result && typeof result === 'object' && Array.isArray(result.content)) {
      const truncatedContent = result.content.map((item: any) => {
        if (item?.text && typeof item.text === 'string') {
          try {
            const parsed = JSON.parse(item.text);
            
            // Handle results with 'records' array (Gmail, Notion, etc.)
            if (parsed.records && Array.isArray(parsed.records)) {
              const originalCount = parsed.records.length;
              const keepCount = 5; // Only keep first 5 records
              
              console.log(`📧 Truncating ${originalCount} records to ${keepCount}`);
              
              return {
                ...item,
                text: JSON.stringify({
                  ...parsed,
                  records: parsed.records.slice(0, keepCount),
                  _truncated: true,
                  _originalCount: originalCount,
                  _truncatedMessage: `⚠️ Result truncated to ${keepCount} of ${originalCount} items to prevent token overflow. The tool returned too much data. To see more results, ask the user to specify filters or use pagination parameters.`
                })
              };
            }
            
            // Handle results with 'data' array
            if (parsed.data && Array.isArray(parsed.data)) {
              const originalCount = parsed.data.length;
              const keepCount = 5;
              
              console.log(`📦 Truncating ${originalCount} data items to ${keepCount}`);
              
              return {
                ...item,
                text: JSON.stringify({
                  ...parsed,
                  data: parsed.data.slice(0, keepCount),
                  _truncated: true,
                  _originalCount: originalCount,
                  _truncatedMessage: `⚠️ Result truncated to ${keepCount} of ${originalCount} items to prevent token overflow.`
                })
              };
            }
            
            // Handle results with 'messages' array (Gmail, Slack, etc.)
            if (parsed.messages && Array.isArray(parsed.messages)) {
              const originalCount = parsed.messages.length;
              const keepCount = 5;
              
              console.log(`💬 Truncating ${originalCount} messages to ${keepCount}`);
              
              return {
                ...item,
                text: JSON.stringify({
                  ...parsed,
                  messages: parsed.messages.slice(0, keepCount),
                  _truncated: true,
                  _originalCount: originalCount,
                  _truncatedMessage: `⚠️ Result truncated to ${keepCount} of ${originalCount} messages.`
                })
              };
            }
            
            // Generic large JSON - just truncate the string
            if (item.text.length > MAX_SIZE_BYTES) {
              console.log(`📄 Truncating generic large JSON response`);
              return {
                ...item,
                text: item.text.substring(0, MAX_SIZE_BYTES) + '\n\n[TRUNCATED - Result too large]'
              };
            }
            
            return item;
          } catch (e) {
            // Not JSON, just truncate the text
            if (item.text.length > MAX_SIZE_BYTES) {
              return {
                ...item,
                text: item.text.substring(0, MAX_SIZE_BYTES) + '\n\n[TRUNCATED - Result too large]'
              };
            }
            return item;
          }
        }
        return item;
      });
      
      const truncatedResult = {
        ...result,
        content: truncatedContent
      };
      
      const newSize = JSON.stringify(truncatedResult).length / 1024;
      console.log(`✅ Result truncated: ${resultSizeKB.toFixed(2)} KB → ${newSize.toFixed(2)} KB\n`);
      
      return truncatedResult;
    }
    
    // Fallback: return truncation message
    console.log(`⚠️  Using fallback truncation`);
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          _error: 'RESULT_TOO_LARGE',
          _message: `The tool '${toolName}' returned ${resultSizeKB.toFixed(2)} KB of data (${estimatedTokens.toLocaleString()} tokens), which would exceed the context window limit. Please use pagination parameters like 'limit', 'maxResults', or 'pageSize' to fetch smaller batches of data.`,
          _originalSizeKB: resultSizeKB.toFixed(2),
          _maxAllowedKB: MAX_SIZE_KB,
          _suggestion: 'Ask the user to refine their query or fetch data in smaller chunks.'
        })
      }]
    };
  }

  /**
   * Retry connection without session ID
   */
  private async retryWithoutSessionId(): Promise<void> {
    this.close();
    this.sessionId = undefined;
    await this.connect();

    if (!this.client) {
      throw new Error('MCP client not initialized after retry');
    }
  }
}
