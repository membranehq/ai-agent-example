/**
 * Most errors that are thrown by the MCP SDK are in the string format of so this function is used to extract the JSON object from the error string.
 *
 * @example
 * ```ts
 * try {
 *   client.listTools()
 * } catch (error) {
 *   const errorJson = extractJsonFromErrorString(String(error));
 *   console.log(errorJson);
 * }
 * ```
 *
 * @param input - The error string to extract the JSON object from.
 * @returns The JSON object or null if no JSON object is found.
 */
export const extractJsonFromErrorString = (
  input: string,
): {
  jsonrpc: string;
  error: {
    code: number;
    message: string;
  };
} | null => {
  const match = input.match(/{.*}$/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch (e) {
      console.error('Invalid JSON:', e);
      return null;
    }
  } else {
    return null;
  }
};
