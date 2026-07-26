'use client';

import * as React from 'react';
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import { cn } from '@/lib/utils';

export const Dropdown = DropdownPrimitive.Root;
export const DropdownTrigger = DropdownPrimitive.Trigger;

export const DropdownContent = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <DropdownPrimitive.Portal>
    <DropdownPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 min-w-[190px] animate-slide-up overflow-hidden rounded-lg border border-rule bg-white p-1 shadow-lift',
        className
      )}
      {...props}
    />
  </DropdownPrimitive.Portal>
));
DropdownContent.displayName = 'DropdownContent';

export const DropdownItem = React.forwardRef<
  React.ElementRef<typeof DropdownPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownPrimitive.Item
    ref={ref}
    className={cn(
      'flex cursor-pointer select-none items-center gap-2 rounded px-2 py-1.5 text-[13px] text-ink outline-none transition-colors focus:bg-chalk',
      className
    )}
    {...props}
  />
));
DropdownItem.displayName = 'DropdownItem';

export const DropdownSeparator = () => <DropdownPrimitive.Separator className="my-1 h-px bg-rule" />;

export const DropdownLabel = ({ children }: { children: React.ReactNode }) => (
  <DropdownPrimitive.Label className="px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-faint">
    {children}
  </DropdownPrimitive.Label>
);
