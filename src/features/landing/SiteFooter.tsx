import { forwardRef } from 'react';
import { Link } from 'react-router';
import { InstagramIcon, WhatsAppIcon } from '@/components/icons';
import { Logo, LogoMark } from '@/components/ui/Logo';
import { useShopSettings } from '@/lib/catalog';
import { formatPhone, waLink } from '@/lib/dates';
import { openCookiePreferences } from '@/features/consent/store';
import { PlaceholderText } from './shopInfo';

export const SiteFooter = forwardRef<HTMLElement>(function SiteFooter(_, ref) {
  const { data: s } = useShopSettings();
  if (!s) return null;
  return (
    <footer ref={ref} className="relative bg-ink-950 pb-[calc(24px+var(--safe-bottom))]">
      <div className="stitch" role="presentation" />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-14 sm:px-6 md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <Logo className="w-36" />
          <address className="mt-6 text-[14px] not-italic leading-relaxed text-text-400">
            <PlaceholderText value={s.address.street} />
            <br />
            <PlaceholderText value={s.address.district} /> · {s.address.city}/{s.address.state}
          </address>
        </div>

        <div>
          <h2 className="font-label text-[14px] text-gold-500">Contato</h2>
          <ul className="mt-4 space-y-1 text-[14px]">
            <li>
              <a href={waLink(s.whatsapp)} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-text-100 hover:text-gold-400">
                <WhatsAppIcon className="size-4" /> <span className="tabular">{formatPhone(`+${s.whatsapp}`)}</span>
              </a>
            </li>
            <li>
              <a href={`https://instagram.com/${s.instagram}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 text-text-100 hover:text-gold-400">
                <InstagramIcon className="size-4" /> @{s.instagram}
              </a>
            </li>
            <li>
              <a href={`mailto:${s.email}`} className="inline-flex min-h-11 items-center text-text-100 hover:text-gold-400">
                {s.email}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="font-label text-[14px] text-gold-500">Privacidade</h2>
          <ul className="mt-4 space-y-1 text-[14px]">
            <li>
              <Link to="/privacidade" className="inline-flex min-h-11 items-center text-text-100 hover:text-gold-400">
                Política de Privacidade
              </Link>
            </li>
            <li>
              <Link to="/termos" className="inline-flex min-h-11 items-center text-text-100 hover:text-gold-400">
                Termos de Uso
              </Link>
            </li>
            <li>
              <Link to="/cookies" className="inline-flex min-h-11 items-center text-text-100 hover:text-gold-400">
                Política de Cookies
              </Link>
            </li>
            <li>
              <button type="button" onClick={openCookiePreferences} className="inline-flex min-h-11 items-center text-text-100 hover:text-gold-400">
                Preferências de cookies
              </button>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-12 flex max-w-6xl flex-col gap-4 border-t border-white/5 px-4 pt-6 text-[12px] text-text-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>
          © {new Date().getFullYear()} <PlaceholderText value={s.legalName} fallback={s.name} /> · CNPJ{' '}
          <PlaceholderText value={s.cnpj} />
        </p>
        <Link
          to="/barbeiro/login"
          className="inline-flex min-h-11 items-center gap-2 self-start text-text-400/80 transition-colors hover:text-gold-400 sm:self-auto"
        >
          <LogoMark className="w-3" />
          Área do Barbeiro
        </Link>
      </div>
    </footer>
  );
});
