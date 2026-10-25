import * as RT from '@radix-ui/react-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { create } from 'zustand';
import { cn } from '@/lib/cn';
import { EASE } from '@/lib/motion';

type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
  duration: number;
  action?: { label: string; onClick: () => void };
}

interface ToastStore {
  items: ToastItem[];
  push: (t: Omit<ToastItem, 'id'>) => number;
  dismiss: (id: number) => void;
}

let seq = 0;
const useToastStore = create<ToastStore>((set) => ({
  items: [],
  push: (t) => {
    const id = ++seq;
    set((s) => ({ items: [...s.items.slice(-2), { ...t, id }] }));
    return id;
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
}));

type ToastOptions = Partial<Pick<ToastItem, 'description' | 'duration' | 'action'>>;

export const toast = {
  success: (title: string, o: ToastOptions = {}) =>
    useToastStore.getState().push({ title, tone: 'success', duration: 4000, ...o }),
  error: (title: string, o: ToastOptions = {}) =>
    useToastStore.getState().push({ title, tone: 'error', duration: 6000, ...o }),
  info: (title: string, o: ToastOptions = {}) =>
    useToastStore.getState().push({ title, tone: 'info', duration: 4000, ...o }),
  dismiss: (id: number) => useToastStore.getState().dismiss(id),
};

const icons = { success: CheckCircle2, error: AlertCircle, info: Info };

export function Toaster() {
  const { items, dismiss } = useToastStore();
  return (
    <RT.Provider swipeDirection="down" label="Notificações">
      <AnimatePresence initial={false}>
        {items.map((t) => {
          const Icon = icons[t.tone];
          return (
            <RT.Root
              key={t.id}
              asChild
              forceMount
              duration={t.duration}
              type={t.tone === 'error' ? 'foreground' : 'background'}
              onOpenChange={(open) => !open && dismiss(t.id)}
            >
              <motion.li
                layout
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, transition: { duration: 0.15 } }}
                transition={{ duration: 0.25, ease: EASE }}
                className="glass pointer-events-auto flex w-full items-start gap-3 !rounded-[16px] !bg-[rgba(16,16,16,0.9)] p-4"
              >
                <Icon
                  className={cn(
                    'mt-0.5 size-5 shrink-0',
                    t.tone === 'success' && 'text-success',
                    t.tone === 'error' && 'text-danger',
                    t.tone === 'info' && 'text-gold-500',
                  )}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  <RT.Title className="text-[14px] font-bold text-text-100">{t.title}</RT.Title>
                  {t.description && (
                    <RT.Description className="mt-0.5 text-[14px] text-text-400">{t.description}</RT.Description>
                  )}
                </div>
                {t.action && (
                  <RT.Action altText={t.action.label} asChild>
                    <button
                      onClick={() => {
                        t.action?.onClick();
                        dismiss(t.id);
                      }}
                      className="font-label -my-1 min-h-11 shrink-0 rounded-[10px] px-3 text-[14px] text-gold-400 hover:bg-gold-500/10"
                    >
                      {t.action.label}
                    </button>
                  </RT.Action>
                )}
                <RT.Close
                  aria-label="Fechar"
                  className="-m-1 grid size-8 shrink-0 place-items-center rounded-full text-text-400 hover:text-text-100"
                >
                  <X className="size-4" strokeWidth={1.75} />
                </RT.Close>
              </motion.li>
            </RT.Root>
          );
        })}
      </AnimatePresence>
      <RT.Viewport className="pointer-events-none fixed inset-x-0 bottom-[calc(88px+var(--safe-bottom))] z-[90] mx-auto flex w-full max-w-md flex-col gap-2 px-4 outline-none md:bottom-6 md:right-6 md:left-auto md:mx-0" />
    </RT.Provider>
  );
}
