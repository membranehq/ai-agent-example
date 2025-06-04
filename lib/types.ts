export type DataPart = { type: 'append-message'; message: string };

export type ExposedTool = {
  id: string;
  integrationName: string;
  key: string;
  text: string;
};
