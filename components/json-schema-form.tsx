'use client';

import { useState } from 'react';
import { DataInput, type DataSchema } from '@integration-app/react';
import { Button } from './ui/button';
import '@integration-app/react/styles.css';
import { ArrowRightIcon } from 'lucide-react';

export function JsonSchemaForm({
  schema,
  onSubmit,
  defaultValues,
  formTitle,
}: {
  schema: DataSchema;
  onSubmit: (data: any) => void;
  defaultValues?: Record<string, unknown>;
  formTitle?: string;
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
      <div className="bg">
        <h3 className="text-lg font-semibold text-foreground">
          Configure Parameters
        </h3>
        <p className="text-sm text-muted-foreground mt-1">{formTitle}</p>
      </div>

      <DataInput
        schema={schema}
        value={value}
        onChange={(importValue: unknown) => setValue(importValue)}
      />

      <Button className="self-end" type="button" onClick={handleSubmit}>
        Continue <ArrowRightIcon className="w-4 h-4" />
      </Button>
    </div>
  );
}
