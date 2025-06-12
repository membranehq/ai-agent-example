export type DataPart = { type: 'append-message'; message: string };

export type ToolIndexItem = {
  id: string;
  integrationKey: string;
  toolKey: string;
  text: string; // description of the tool (naming it "text" because Pinecone embeds 'text' by default)
};
