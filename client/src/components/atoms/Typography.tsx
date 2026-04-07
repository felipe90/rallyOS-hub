import type { ReactNode, ElementType } from 'react';

/* Typography Atom - Kinetic Clubhouse text components */
export type TypographyVariant = 'headline' | 'title' | 'body' | 'label' | 'caption';
export type TypographyWeight = 300 | 400 | 500 | 600 | 700;

interface TypographyProps {
  variant?: TypographyVariant;
  weight?: TypographyWeight;
  children: ReactNode;
  className?: string;
  as?: ElementType;
}

const variantStyles: Record<TypographyVariant, string> = {
  headline: 'font-heading text-[56px] leading-[1.1] tracking-[-1.68px]',
  title: 'font-heading text-[28px] leading-[1.2] tracking-[-0.56px]',
  body: 'font-body text-[18px] leading-[145%] tracking-[0.18px]',
  label: 'font-body text-[14px] leading-[130%] tracking-[0.14px] uppercase tracking-widest',
  caption: 'font-body text-[12px] leading-[130%] tracking-[0.12px]',
};

const weightStyles: Record<TypographyWeight, string> = {
  300: 'font-light',
  400: 'font-normal',
  500: 'font-medium',
  600: 'font-semibold',
  700: 'font-bold',
};

export function Typography({ 
  variant = 'body', 
  weight = 400, 
  children, 
  className = '',
  as: Component = 'p',
}: TypographyProps) {
  const baseStyles = `text-text-h ${variantStyles[variant]} ${weightStyles[weight]} ${className}`;
  
  return <Component className={baseStyles}>{children}</Component>;
}

export function Headline({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <Typography variant="headline" weight={500} as="h1" className={className}>{children}</Typography>;
}

export function Title({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <Typography variant="title" weight={500} as="h2" className={className}>{children}</Typography>;
}

export function Body({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <Typography variant="body" weight={400} className={className}>{children}</Typography>;
}

export function Label({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <Typography variant="label" weight={500} className={className}>{children}</Typography>;
}

export function Caption({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <Typography variant="caption" weight={400} className={className}>{children}</Typography>;
}