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

3. Copy the environment variables from `.env.example` to `.env` and fill in the values.

```bash
cp .env.example .env
```

4. Push migrations to the database using

```bash
pnpm db:push
```

5. Create a new index in Pinecone. See details on how to create an index on Pinecone [here](https://docs.pinecone.io/reference/create_index). Once you have created the index, add the index name to the `PINECONE_INDEX_NAME` environment variable and run the following command to index your actions.

```bash
pnpm pinecone:index-actions
```

6. Run the development server

```bash
pnpm dev
```

### Notes

**Gradual tools exposure**
