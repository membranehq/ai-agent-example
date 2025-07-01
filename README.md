## Integration App AI Agent Example

This is an example of an AI agent that uses the Integration App to provide integration capabilities to users via tools.

### Prerequisites 🛠️

- **Integration App** – the central platform for building and running your app integrations.  
  [integration.app](https://integration-app.com/)

- **Pinecone** – a managed vector database used to store and query embeddings (e.g., for tool/data lookup).  
  [pinecone.io](https://www.pinecone.io/)

- **Anthropic Claude** – the default LLM in this project (easily swapped for others if needed).  
  [Learn about providers](https://sdk.vercel.ai/providers/ai-sdk-providers)

- **PostgreSQL** – stores all chat/session logs; any Postgres setup works.  
  [postgresql.org](https://www.postgresql.org/)

### Setup Guide 🔧

1. **Clone the repository**

```bash
git clone https://github.com/integration-app/ai-agent.git
```

2. **Install dependencies**

```bash
pnpm install
```

3. **Configure environment variables**

```bash
cp .env.example .env
```

Then edit .env to add your API keys, index names, DB connection string, etc. (Comments and links are included for guidance.)

4. **Create Pinecone indexes**

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

5. **Run database migrations**

```bash
pnpm db:push
```

6. Index all actions in Pinecone

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

![AI Agent Example Arch Frame 1](https://github.com/user-attachments/assets/c7127be2-0788-4714-86f7-55ba5fd6b587)

#### Summary

- Pre-index the metadata of all available actions in your workspace.
- When a user starts a chat to perform a task, we search the MCP tools index for the most relevant tools based on the user’s query.
- If no relevant tool is found in the MCP index, the LLM will fall back to searching the full index of all available workspace actions.
- The LLM is then provided with the most relevant tool to call based on the search results.
