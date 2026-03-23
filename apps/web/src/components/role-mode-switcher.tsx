/**
 * Role mode switcher.
 * Displays the active workspace mode and lets multi-capability users switch
 * between buyer, supplier, and carrier contexts from top header.
 */
'use client';

import { useRouter } from 'next/navigation';
import { Check, ChevronDown } from 'lucide-react';
import { useMode, type Mode } from '@/lib/mode-context';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ROLE_HOME: Record<Mode, string> = {
  BUYER: '/dashboard/buyer',
  SUPPLIER: '/dashboard/supplier',
  CARRIER: '/dashboard/transporter',
};

const MODE_LABEL: Record<Mode, string> = {
  BUYER: 'Pasutitajs',
  SUPPLIER: 'Piegadatajs',
  CARRIER: 'Parvadatajs',
};

export function RoleModeSwitcher() {
  const router = useRouter();
  const { activeMode, setActiveMode, availableModes } = useMode();

  if (availableModes.length <= 1) return null;

  const onSelect = (mode: Mode) => {
    if (mode === activeMode) return;
    setActiveMode(mode);
    router.push(ROLE_HOME[mode]);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1 text-xs">
          <span>{MODE_LABEL[activeMode]}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {availableModes.map((mode) => {
          const isActive = mode === activeMode;
          return (
            <DropdownMenuItem
              key={mode}
              className="text-xs justify-between"
              disabled={isActive}
              onClick={() => onSelect(mode)}
            >
              <span>{MODE_LABEL[mode]}</span>
              {isActive && <Check className="size-3.5 text-primary" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
