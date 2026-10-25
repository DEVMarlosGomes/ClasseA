import type { ReactNode } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { LegalDocType } from '@shared/types';
import { ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/lib/cn';
import { shortDate } from '@/lib/dates';
import { slugify, useLegalDoc } from './useLegalDoc';

function text(children: ReactNode): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(text).join('');
  return '';
}

/** Comfortable reading typography for the legal drafts. */
export default function LegalDocBody({ type, compact = false }: { type: LegalDocType; compact?: boolean }) {
  const { data, isLoading, isError, refetch } = useLegalDoc(type);
  if (isError) return <ErrorState onRetry={() => void refetch()} />;
  if (isLoading || !data)
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className={i % 3 === 0 ? 'h-6 w-1/2' : 'h-4'} />
        ))}
      </div>
    );
  return (
    <article className={cn('legal text-[16px] leading-[1.75] text-text-100/90', compact && 'text-[15px]')}>
      <p className="tabular mb-6 text-[14px] text-text-400">
        Versão {data.version} · Vigente desde {shortDate(data.effectiveAt)}
      </p>
      <Markdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2 id={slugify(text(children))} className="font-label mb-3 mt-10 scroll-mt-24 text-[22px] text-gold-500 first:mt-0">
              {children}
            </h2>
          ),
          p: ({ children }) => <p className="my-3">{children}</p>,
          ul: ({ children }) => <ul className="my-3 list-disc space-y-1.5 pl-5 marker:text-gold-600">{children}</ul>,
          ol: ({ children }) => <ol className="my-3 list-decimal space-y-1.5 pl-5 marker:text-gold-600">{children}</ol>,
          strong: ({ children }) => <strong className="font-bold text-text-100">{children}</strong>,
          a: ({ children, href }) => (
            <a href={href} className="text-gold-400 underline">
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-6 rounded-[14px] border border-gold-700/60 bg-gold-500/5 px-5 py-1 text-[14px] text-text-100">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="my-5 overflow-x-auto rounded-[14px] border border-ink-600">
              <table className="w-full min-w-[520px] border-collapse text-left text-[14px]">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border-b border-ink-600 bg-ink-800 px-4 py-3 font-bold text-text-100">{children}</th>,
          td: ({ children }) => <td className="border-b border-ink-700 px-4 py-3 align-top text-text-100/85">{children}</td>,
          code: ({ children }) => <code className="rounded bg-ink-700 px-1.5 py-0.5 text-[13px] text-gold-400">{children}</code>,
        }}
      >
        {data.markdown}
      </Markdown>
    </article>
  );
}
