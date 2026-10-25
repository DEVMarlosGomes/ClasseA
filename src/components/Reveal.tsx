import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';
import { rise, riseReduced, stagger } from '@/lib/motion';

/** Rises 24px with a fade when scrolled into view; children marked <RevealItem> cascade 60ms apart. */
export function Reveal({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'ul' | 'section' }) {
  const reduced = useReducedMotion();
  const Tag = motion[as];
  return (
    <Tag
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '0px 0px -10% 0px' }}
      variants={stagger(reduced)}
    >
      {children}
    </Tag>
  );
}

export function RevealItem({ children, className, as = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'li' }) {
  const reduced = useReducedMotion();
  const Tag = motion[as];
  return (
    <Tag className={className} variants={reduced ? riseReduced : rise}>
      {children}
    </Tag>
  );
}
