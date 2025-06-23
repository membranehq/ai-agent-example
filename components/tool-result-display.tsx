'use client';

import { CheckIcon, ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';

interface ToolResultDisplayProps {
  toolName: string;
  result: any;
  children?: React.ReactNode;
  input: any;
}

export const ToolResultDisplay = ({
  toolName,
  result,
  children,
  input,
}: ToolResultDisplayProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <div className="bg-muted p-4 rounded-lg mr-10">
        <div className="flex items-center gap-2">
          <CheckIcon strokeWidth={3} size={18} className="text-green-600" />
          <span className="text-sm font-medium text-foreground">
            {toolName}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto size-6 p-0 transition-transform duration-200"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <ChevronRightIcon
              size={14}
              className={`transition-transform duration-200 ${
                isExpanded ? 'rotate-90' : 'rotate-0'
              }`}
            />
          </Button>
        </div>

        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            isExpanded
              ? 'max-h-64 opacity-100 mt-3 pt-3 border-t border-border overflow-y-auto'
              : 'max-h-0 opacity-0'
          }`}
        >
          <div className="space-y-3">
            <div>
              <span className="text-xs font-medium text-muted-foreground mb-1 block">
                Input
              </span>
              <pre className="text-sm overflow-x-auto bg-background p-3 rounded border">
                {JSON.stringify(input, null, 2)}
              </pre>
            </div>

            <div>
              <span className="text-xs font-medium text-muted-foreground mb-1 block">
                Output
              </span>
              <pre className="text-sm overflow-x-auto bg-background p-3 rounded border">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
      {children}
    </>
  );
};
