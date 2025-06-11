export type DataPart = { type: 'append-message'; message: string };

export type ToolIndexItem = {
  id: string;
  integrationName: string;

  toolKey: string;
  text: string;
};