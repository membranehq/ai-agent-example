import { z } from 'zod';
import { IntegrationAppClient } from '@integration-app/sdk';
// import { generateObject } from 'ai';
// import { myProvider } from '../providers';
// import { JSONSchemaToZod } from '@dmitryrechkin/json-schema-to-zod';

const parameters = z.object({
  toolName: z.string().describe('The name of the tool to collect input for'),
  inputsAlreadyProvided: z
    .record(z.string())
    .describe('The inputs already provided for the tool make'),
  formTitle: z
    .string()
    .describe(
      'The title of the form, that describes what the user should fill in',
    ),
});

// const prefillSchema = async (jsonSchema: any, input: Record<string, any>) => {
//   const zodSchema = jsonSchema
//     ? JSONSchemaToZod.convert(jsonSchema)
//     : z.object({});

//   const systemPrompt = `
//    You are a JSON schema filler, You'll be provided a JSON schema and some input, fill input into the JSON schema as default values and return the new JSON schema
//   `;

//   const prompt = `
//     Based on the schema and the input, add the input as default values to the schema and return the schema with the default values

//     <schema>
//       ${JSON.stringify(jsonSchema)}
//     </schema>

//     <input>
//       ${JSON.stringify(input)}
//     </input>
//     `;

//   const { object } = await generateObject({
//     model: myProvider.languageModel('refine-apps-model'),
//     temperature: 0,
//     system: systemPrompt,
//     prompt,
//     schema: zodSchema,
//   });

//   return object;
// };

export const renderForm = (token: string) => {
  return {
    description: `Render a form to collect input for a tool`,
    parameters,
    execute: async ({
      toolName,
      inputsAlreadyProvided,
      formTitle,
    }: z.infer<typeof parameters>) => {
      try {
        // toolName is in the format of integrationKey_actionKey_actionKey_...
        // we need to get the integrationKey and the actionKey
        const [integrationKey, ...actionKeyArray] = toolName.split('_');

        const membrane = new IntegrationAppClient({
          token,
        });

        const actionKey = actionKeyArray.join('_');

        const action = await membrane
          .action({
            integrationKey,
            key: actionKey,
          })
          .get();

        return {
          success: true,
          data: {
            message: `Now, use this information to render a form to collect input for the tool`,
            toolInputSchema: action.inputSchema,
            inputsAlreadyProvided,
            formTitle,
          },
        };
      } catch (error) {
        console.error(error);
        return {
          success: false,
          error: {
            type: 'internal_error',
            message: 'Failed to render form',
          },
        };
      }
    },
  };
};
