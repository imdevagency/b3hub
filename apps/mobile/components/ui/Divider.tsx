/**
 * Divider — A thin 1px horizontal rule for separating content blocks.
 *
 * Replaces inline `<View style={{ height: 1, backgroundColor: '#e5e7eb' }} />`
 * fragments scattered across layouts.
 *
 * Usage:
 *   <Divider />                        // default: #f3f4f6, no vertical margin
 *   <Divider color="#e5e7eb" />        // slightly darker border
 *   <Divider marginV={8} />            // with vertical margin
 */

import React from 'react';
import { View } from 'react-native';

interface DividerProps {
  /** Line color — defaults to '#f3f4f6' (light border). */
  color?: string;
  /** Vertical margin applied to both top and bottom — defaults to 0. */
  marginV?: number;
}

export function Divider({ color = '#f3f4f6', marginV = 0 }: DividerProps) {
  return <View style={{ height: 1, backgroundColor: color, marginVertical: marginV }} />;
}
