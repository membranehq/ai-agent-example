'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LoaderIcon } from '@/components/icons';
import { toast } from '@/components/toast';
import { useUserProfile } from '@/hooks/use-user-profile';

export function EmailCollectionModal() {
  const { email: userEmail, isLoading, updateEmail } = useUserProfile();
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();

    if (!trimmedEmail) {
      toast({ type: 'error', description: 'Please enter your email address' });
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast({ type: 'error', description: 'Please enter a valid email address' });
      return;
    }

    setIsSubmitting(true);
    try {
      await updateEmail(trimmedEmail);
      toast({ type: 'success', description: 'Email saved successfully!' });
    } catch (error) {
      toast({
        type: 'error',
        description: error instanceof Error ? error.message : 'Failed to save email',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || userEmail) return null;

  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent
        className="w-[95vw] sm:max-w-md"
        showCloseButton={false}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Welcome!</DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Please enter your email address to continue.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
              autoFocus
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <LoaderIcon size={14} />
                <span className="ml-2">Saving...</span>
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
