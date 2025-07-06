'use client';

import { useState } from 'react';
import { DataInput, type DataSchema } from '@integration-app/react';
import { Button } from './ui/button';
import '@integration-app/react/styles.css';
import { ArrowRightIcon, CheckIcon, FormInputIcon } from 'lucide-react';

export function JsonSchemaForm({
  schema,
  onSubmit,
  defaultValues,
  formTitle,
  isCollapsed,
}: {
  schema: DataSchema;
  onSubmit: (data: any) => void;
  defaultValues?: Record<string, unknown>;
  formTitle?: string;
  isCollapsed?: boolean;
}) {
  const [value, setValue] = useState<unknown>(defaultValues ?? {});

  const handleSubmit = () => {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.values(value).every((v) => typeof v !== 'object' || v === null)
    ) {
      const formatted = Object.entries(value)
        .map(([k, v]) => `${k}: ${v}`)
        .join('\n');
      onSubmit(formatted);
    } else {
      onSubmit(`Input: ${JSON.stringify(value)}`);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="bg flex justify-between items-start">
        <div className="text-sm text-muted-foreground flex items-center gap-2 font-medium">
          <FormInputIcon className="size-4" />
          {formTitle}
        </div>
        {isCollapsed && (
          <CheckIcon strokeWidth={3} size={18} className="text-green-600" />
        )}
      </div>

      {!isCollapsed && (
        <>
          <DataInput
            schema={schema}
            value={value}
            onChange={(importValue: unknown) => setValue(importValue)}
          />

          <Button className="self-end" type="button" onClick={handleSubmit}>
            Continue <ArrowRightIcon className="size-4" />
          </Button>
        </>
      )}
    </div>
  );
}
