import type { ReactNode, ElementType } from 'react';

export type TypographyVariant = 'headline' | 'title' | 'body' | 'label' | 'caption';
export type TypographyWeight = 300 | 400 | 500 | 600 | 700;

export interface TypographyProps {
  variant?: TypographyVariant;
  weight?: TypographyWeight;
  children: ReactNode;
  className?: string;
  as?: ElementType;
}

export interface TypographySubcomponentProps {
  children: ReactNode;
  className?: string;
}