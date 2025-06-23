'use client';

import { useState } from 'react';
import { DataInput, type DataSchema } from '@integration-app/react';
import { Button } from './ui/button';
import '@integration-app/react/styles.css';

export function JsonSchemaForm({
  schema,
  onSubmit,
}: {
  schema: DataSchema;
  onSubmit: (data: any) => void;
}) {
  const [value, setValue] = useState<unknown>({});

  const handleSubmit = () => {
    onSubmit(`Input: ${JSON.stringify(value)}`);
  };

  return (
    <div className="flex flex-col gap-4">
      <DataInput
        schema={schema}
        value={value}
        onChange={(importValue: unknown) => setValue(importValue)}
      />

      <Button className="self-end" type="button" onClick={handleSubmit}>
        Continue
      </Button>
    </div>
  );
}
