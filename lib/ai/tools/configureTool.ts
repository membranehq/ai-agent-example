import { tool } from 'ai';
import { z } from 'zod';

export const configureToolInput = (toolName: string) =>
  tool({
    description: `Get the schema of the tool so a form can be generated to collect input `,
    // can be Any object
    parameters: z.object({
      toolSchema: z
        .record(z.any())
        .describe('The parameters schema needed to call the tool'),
    }),

    execute: async ({ toolSchema }) => {
      return {
        message: `You are in in configuration mode, and you are configuring "${toolName}". 
        Fill in the form below to continue`,
        toolSchema,
      };
    },
  });
