import { tool } from 'ai';
import { z } from 'zod';
import { IntegrationAppClient } from '@integration-app/sdk';

/**
 * TODO: Maybe Move membrane call to frontend to make things visually faster
 */

export const renderForm = (token: string) =>
  tool({
    description: `Render a form to collect input for a tool`,

    parameters: z.object({
      toolName: z
        .string()
        .describe('The name of the tool to collect input for'),
      inputsAlreadyProvided: z
        .record(z.string())
        .describe('The inputs already provided for the tool make'),
      formTitle: z
        .string()
        .describe(
          'The title of the form, that describes what the user should fill in',
        ),
    }),

    execute: async ({ toolName, inputsAlreadyProvided, formTitle }) => {
      const [integrationKey, ...actionKeyArray] = toolName.split('_');

      const membrane = new IntegrationAppClient({
        token,
      });

      const actionKey = actionKeyArray.join('_');

      const action = await membrane
        .action({
          integrationKey,
          key: actionKey, // The key here is not reliable since MCP may have truncated the tool name if it's too long
        })
        .get();

      return {
        message: `Now, use this information to render a form to collect input for the tool`,
        toolInputSchema: action.inputSchema,
        inputsAlreadyProvided,
        formTitle,
      };
    },
  });
