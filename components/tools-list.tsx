import { fetcher } from '@/lib/utils';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Settings2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export function ListTools() {
  const { data: tools, error } = useSWR('/api/tools', fetcher);

  if (error) {
    console.error('Error fetching tools:', error);
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings2 /> Tools
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Available Tools</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto min-h-[200px] max-h-[70vh]">
          {!tools ? (
            <div>Loading Tools...</div>
          ) : (
            <pre>{JSON.stringify(tools, null, 2)}</pre>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
