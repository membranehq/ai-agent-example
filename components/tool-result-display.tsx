'use client';

import { CheckIcon, ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';

interface ToolResultDisplayProps {
  toolName: string;
  result: any;
  children?: React.ReactNode;
}


export const ToolResultDisplay = ({
  toolName,
  result,
  children,
}: ToolResultDisplayProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <div className="bg-muted p-4 rounded-lg">
        <div className="flex items-center gap-2">
          <CheckIcon strokeWidth={3} size={18} className="text-green-600" />
          <span className="text-sm font-medium text-foreground">
            {toolName}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto size-6 p-0"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronDownIcon size={14} />
            ) : (
              <ChevronRightIcon size={14} />
            )}
          </Button>
        </div>

        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-border">
            <pre className="text-sm overflow-x-auto bg-background p-3 rounded border">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}
      </div>
      {children}
    </>
  );
};
