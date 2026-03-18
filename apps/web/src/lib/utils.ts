/**
 * Utility helpers.
 * cn() — merges Tailwind class names using clsx + tailwind-merge.
 * Other shared formatting/transformation utilities used across the web app.
 */
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
