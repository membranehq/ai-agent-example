## Membrane AI Agent Example

This is an example of an AI agent that uses the Integration App MCP server. Rather than exposing all available tools from the MCP server to the language model, it dynamically selects and provides only a small, relevant subset based on the user’s query. See [how it works](#how-it-works) for more details.

**Why is this useful?**

- LLMs struggle when overloaded with too many tools, tool-selection accuracy drops dramatically as tool count increases
- Narrowing down tools help you spend less since the token count for request to the LLM is reduced.
- Most LLMs have a hard limit on number of tool that can be provided

### Prerequisites 🛠️

- **Integration App** – the central platform for building and running your app integrations.  
  [integration.app](https://integration-app.com/)

- **Pinecone** – a managed vector database used to store and query embeddings (e.g., for tool/data lookup).  
  [pinecone.io](https://www.pinecone.io/)

- **Anthropic Claude** – the default LLM in this project (can be easily swapped for others if needed).  
  [Learn about providers](https://sdk.vercel.ai/providers/ai-sdk-providers)

- **PostgreSQL** – Stores all chat history and user information. You can use [Supabase](https://supabase.com/) for a free and easy setup.

### Setup Guide 🔧

**Clone the repository**

```bash
git clone https://github.com/integration-app/ai-agent.git
```

**Install dependencies**

```bash
pnpm install
```

**Configure environment variables**

```bash
cp .env.example .env
```

Then edit .env to add your API keys, index names, DB connection string, etc. (Comments and links are included for guidance.)

**Create Pinecone indexes**

You’ll need two vector indexes:

- **Membrane actions** – stores metadata for all available actions in your workspace
- **Client tools** – stores metadata for your users’ available tools from MCP

Use Pinecone web console or CLI. For example via CLI:

```bash
pinecone index create \
  --name your-membrane-index \
  --dimension 1536 \
  --metric cosine

pinecone index create \
  --name your-client-index \
  --dimension 1536 \
  --metric cosine
```

Then update .env with:

```bash
PINECONE_MEMBRANE_TOOLS="your-membrane-index"
PINECONE_CLIENT_TOOLS="your-client-index"
```

**Index all actions in Pinecone**

```bash
pnpm pinecone:index-actions
```

**Run database migrations**

```bash
pnpm db:push
```

🚀 You're ready! Now run the development server:

```bash
pnpm dev
```

### Configuration ⚙️

**Tool Result Truncation**

To prevent token overflow errors, large tool results are automatically truncated. You can configure the truncation threshold via the `MAX_TOOL_RESULT_SIZE_KB` environment variable (default: 50KB).

```bash
# .env
MAX_TOOL_RESULT_SIZE_KB=50  # ~12,500 tokens
```

**Adjusting for different models:**

- **Claude (200K tokens)**: 50KB (default) ✅
- **GPT-4 Turbo (128K tokens)**: 30-40KB recommended
- **Gemini 1.5 Pro (1M tokens)**: 200-300KB possible
- **Claude 3.5 Sonnet (200K tokens)**: 50KB (default) ✅

The default setting works with most models. Only increase if you're using a model with a significantly larger context window and need more data per tool result.

### How it works

When an MCP server provide a large number of tools to an LLM, the following can happen:

- The LLM can completely freeze or hallucinate on what tools to call
- LLM consumes a large number of token per message since the tool list is sent in the request

To solve this problem, this example exposes a small number of tools to the LLM based on the user query.

Here's a diagram that shows how it works:

![AI Agent Example Frame 1](https://github.com/user-attachments/assets/424a664f-4dff-4eab-9210-e51992b8b354)

#### Summary

- Pre-index the metadata of all available actions in your workspace.
- When a user starts a chat to perform a task, prompt LLM to search the MCP tools index for the most relevant tools based on the user’s query.
- If no relevant tool is found in the MCP index, the LLM will fall back to searching the full index of all available workspace actions.
- The LLM is then provided with the most relevant tool to call based on the search results.
- When a new app is connected, we re-index the MCP server with available actions.
