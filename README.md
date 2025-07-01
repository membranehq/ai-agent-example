## Integration App AI Agent Example

This is an example of an AI agent that uses the Integration App MCP server. Rather than providing all tools to LLM at once, it provides a small number of tools based on the user's query.

For a similar example where all tools are provided to LLM at once, see [ai-agent](https://github.com/integration-app/ai-agent).

### Prerequisites 🛠️

- **Integration App** – the central platform for building and running your app integrations.  
  [integration.app](https://integration-app.com/)

- **Pinecone** – a managed vector database used to store and query embeddings (e.g., for tool/data lookup).  
  [pinecone.io](https://www.pinecone.io/)

- **Anthropic Claude** – the default LLM in this project (easily swapped for others if needed).  
  [Learn about providers](https://sdk.vercel.ai/providers/ai-sdk-providers)

- **PostgreSQL** – stores all chat/session logs; any Postgres setup works. You can use [Supabase](https://supabase.com/) for a free and easy setup.

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

**Run database migrations**

```bash
pnpm db:push
```

**Index all actions in Pinecone**

```bash
pnpm pinecone:index-actions
```

🚀 You’re ready! Now run the development server:

```bash
pnpm dev
```

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



