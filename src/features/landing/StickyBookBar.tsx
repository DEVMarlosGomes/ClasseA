import { AnimatePresence, motion } from 'framer-motion';
import { ButtonLink } from '@/components/ui/Button';
import { EASE } from '@/lib/motion';

/** Mobile-only bar that appears once the hero is out of view and hides when the footer enters. */
export function StickyBookBar({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 96, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 96, opacity: 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="glass pb-safe fixed inset-x-0 bottom-0 z-40 !rounded-none !rounded-t-[20px] !border-x-0 !border-b-0 px-4 pt-3 md:hidden"
        >
          <ButtonLink to="/agendar" block size="lg">
            Agendar horário
          </ButtonLink>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
