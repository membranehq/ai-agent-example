'use client';

import { useState } from 'react';
import { DataInput, type DataSchema } from '@integration-app/react';
import { Button } from './ui/button';
import '@integration-app/react/styles.css';
import { ArrowRightIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';

export function JsonSchemaForm({
  schema,
  onSubmit,
  defaultValues,
  formTitle,
  isCollapsed: _isCollapsed,
}: {
  schema: DataSchema;
  onSubmit: (data: any) => void;
  defaultValues?: Record<string, unknown>;
  formTitle?: string;
  isCollapsed?: boolean;
}) {
  const [value, setValue] = useState<unknown>(defaultValues ?? {});
  const [isCollapsed, setIsCollapsed] = useState(_isCollapsed ?? false);

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
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Configure Parameters
          </h3>
          <p className="text-sm text-muted-foreground mt-1">{formTitle}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="size-8 p-0"
        >
          {isCollapsed ? (
            <ChevronDownIcon className="size-4" />
          ) : (
            <ChevronUpIcon className="size-4" />
          )}
        </Button>
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
