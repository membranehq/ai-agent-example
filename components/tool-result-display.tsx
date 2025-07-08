'use client';

import { CheckIcon, ChevronsUpDownIcon, Cloud } from 'lucide-react';
import { useState } from 'react';
import { Button } from './ui/button';

interface ToolResultDisplayProps {
  toolName: string;
  result: any;
  input: any;
  isStaticTool?: boolean;
}

export const ToolResultDisplay = ({
  toolName,
  result,
  input,
  isStaticTool = false,
}: ToolResultDisplayProps) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="pr-4 rounded-lg mr-10">
      <Button
        variant="ghost"
        size="sm"
        className="flex items-center gap-2 h-auto p-2 transition-transform duration-200 group"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <CheckIcon strokeWidth={3} size={18} className="text-green-600" />
        <span className="text-sm font-medium text-foreground">{toolName}</span>
        {!isStaticTool && <Cloud size={14} className="text-muted-foreground" />}
        <ChevronsUpDownIcon
          size={14}
          className="transition-all duration-200 opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0"
        />
      </Button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'opacity-100 pt-3 overflow-y-auto' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="bg-muted p-4 rounded-lg space-y-3">
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
  );
};
