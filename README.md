### Integration App AI Agent

This is an example of an AI agent that uses the Integration App to provide integration capabilities to users via tools.

#### Prerequisites

- [Integration App](https://integration-app.com/): Provides AI agents with integration capabilities.

- [Pinecone](https://www.pinecone.io/): A vector database for storing and querying embeddings. We use this to store data about all available tools based on actions defined in your integration app workspace.

- [Claude](https://www.anthropic.com/): This project uses Claude as the LLM provider, but you can use any other LLM provider. See details on how to use other LLM providers [here](https://sdk.vercel.ai/providers/ai-sdk-providers).

- [Postgres Database](https://www.postgresql.org/): This project uses Postgres to store chats. You can use any Postgres database of your choice.

#### Setup Guide

1. Clone the repository

```bash
git clone https://github.com/integration-app/ai-agent.git
```

2. Install dependencies using

```bash
pnpm install
```

3. Copy the environment variables from `.env.example` to `.env` and fill in the values. The file contains relevant link for how to get the values for each environment variable.

```bash
cp .env.example .env
```

4. Create two indexes in Pinecone. One will store metadata for all available actions in your workspace. The other will store metadata of available tools for all your users. See details on how to create an index on Pinecone [here](https://docs.pinecone.io/reference/create_index). Once you have created the indexes, add the index names to the following environment variables:

```bash
# index to store all membrane actions
PINECONE_MEMBRANE_TOOLS=""

# Index to store all user available tools
PINECONE_CLIENT_TOOLS=""
```

5. Push migrations to the database using

```bash
pnpm db:push
```

6. Index actions using this command:

```bash
pnpm pinecone:index-actions
```

### Running the development server

```bash
pnpm dev
```

### How it works

When an MCP server provide a large number of tools to an LLM, the following can happen:

- The LLM can completely freeze or hallucinate on what tools to call
- LLM consumes a large number of token per message since the tool list is sent in the request

To solve this problem, this example exposes a small number of tools to the LLM based on the user query.

Here's a diagram that shows how it works:

![How it works](./docs/how-it-works.png)

Summary:

- Pre-index the metadata of all available actions in your workspace.
- When a user starts a chat to perform a task, we search the MCP tools index for the most relevant tools based on the user’s query.
- If no relevant tool is found in the MCP index, the LLM will fall back to searching the full index of all available workspace actions.
- The LLM is then provided with the most relevant tool to call based on the search results.
