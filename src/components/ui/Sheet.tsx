import * as Dialog from '@radix-ui/react-dialog';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useIsDesktop } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/cn';
import { EASE } from '@/lib/motion';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Max width of the centred modal on desktop. */
  size?: 'sm' | 'md' | 'lg';
  hideTitle?: boolean;
}

const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' };

/** Bottom sheet below 768 px, centred modal from 768 px. Radix handles focus trap and Escape. */
export function Sheet({ open, onOpenChange, title, description, children, footer, size = 'md', hideTitle }: SheetProps) {
  const desktop = useIsDesktop();
  const reduced = useReducedMotion();
  const panel = desktop
    ? {
        initial: { opacity: 0, scale: reduced ? 1 : 0.97, y: reduced ? 0 : 8 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: reduced ? 1 : 0.98 },
      }
    : {
        initial: { y: reduced ? 0 : '100%', opacity: reduced ? 0 : 1 },
        animate: { y: 0, opacity: 1 },
        exit: { y: reduced ? 0 : '100%', opacity: reduced ? 0 : 1 },
      };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild forceMount>
              <motion.div
                className="fixed inset-0 z-[70] bg-black/70"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild forceMount {...(description ? {} : { 'aria-describedby': undefined })}>
              <motion.div
                {...panel}
                transition={{ duration: desktop ? 0.25 : 0.35, ease: EASE }}
                drag={!desktop && !reduced ? 'y' : false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.6 }}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 120 || info.velocity.y > 600) onOpenChange(false);
                }}
                className={cn(
                  'glass fixed z-[71] flex flex-col !bg-[rgba(14,14,14,0.92)] outline-none',
                  desktop
                    ? cn('inset-0 m-auto h-fit max-h-[85dvh] w-[calc(100%-48px)]', widths[size])
                    : 'inset-x-0 bottom-0 max-h-[92dvh] !rounded-b-none !rounded-t-[24px] border-b-0',
                )}
              >
                {!desktop && (
                  <div className="flex justify-center pt-3" aria-hidden="true">
                    <span className="h-1 w-10 rounded-full bg-ink-600" />
                  </div>
                )}
                <div className={cn('flex items-start gap-4 px-5 pt-4 sm:px-6 sm:pt-6', hideTitle && 'sr-only')}>
                  <div className="min-w-0 flex-1">
                    <Dialog.Title className="font-label text-[22px] text-text-100">{title}</Dialog.Title>
                    {description && (
                      <Dialog.Description className="mt-1 text-[14px] text-text-400">{description}</Dialog.Description>
                    )}
                  </div>
                  <Dialog.Close
                    className="-mr-2 -mt-1 grid size-11 shrink-0 place-items-center rounded-full text-text-400 hover:bg-white/5 hover:text-text-100"
                    aria-label="Fechar"
                  >
                    <X className="size-5" strokeWidth={1.75} />
                  </Dialog.Close>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-4 sm:px-6">{children}</div>
                {footer && <div className="pb-safe border-t border-white/5 px-5 pt-3 sm:px-6 sm:pb-5">{footer}</div>}
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
