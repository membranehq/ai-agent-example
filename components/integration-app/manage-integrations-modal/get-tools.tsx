export interface Tool {
  description: string;
  inputSchema: Record<string, any>;
}

export const getAllTools = async (): Promise<Record<string, Tool>> => {
  try {
    const response = await fetch('/api/tools');
    if (!response.ok) {
      throw new Error('Failed to fetch tools');
    }

    const tools = await response.json();
    return tools || {};
  } catch (error) {
    console.error('Error fetching tools:', error);
    return {};
  }
};
