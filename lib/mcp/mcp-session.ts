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
      return result;
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
