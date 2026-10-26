import { Clock, MapPin, Navigation } from 'lucide-react';
import { useState } from 'react';
import { InstagramIcon, WhatsAppIcon } from '@/components/icons';
import { Reveal, RevealItem } from '@/components/Reveal';
import { buttonClass } from '@/components/ui/Button';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { useShopSettings } from '@/lib/catalog';
import { waLink } from '@/lib/dates';
import { isPlaceholder } from '@shared/defaults';
import { PlaceholderText, formatAddress, mapsUrl } from './shopInfo';

export function LocationSection() {
  const { data: s } = useShopSettings();
  const [mapOn, setMapOn] = useState(false);
  if (!s) return null;
  const query = encodeURIComponent(s.address.mapsQuery || formatAddress(s));

  return (
    <section
      id="contato"
      aria-labelledby="contato-title"
      className="scroll-mt-20 bg-ink-900/70 px-4 py-20 sm:px-6 sm:py-28"
    >
      <div className="mx-auto max-w-6xl">
        <SectionTitle id="contato-title">Localização e contato</SectionTitle>
        <Reveal className="mt-10 grid gap-4 lg:grid-cols-[1.1fr_1fr]">
          <RevealItem className="relative min-h-[300px] overflow-hidden rounded-[20px] border border-gold-500/15 bg-ink-800">
            {mapOn ? (
              <iframe
                title="Mapa da Classe A Barbearia"
                src={`https://www.google.com/maps?q=${query}&output=embed`}
                className="absolute inset-0 h-full w-full grayscale-[0.6] invert-[0.9] hue-rotate-180"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <button
                type="button"
                onClick={() => setMapOn(true)}
                className="group absolute inset-0 grid place-items-center bg-[radial-gradient(60%_60%_at_50%_45%,rgba(233,181,66,0.12),transparent_70%)] p-6 text-center"
              >
                <span className="flex flex-col items-center gap-3">
                  <MapPin
                    className="size-8 text-gold-500 transition-transform duration-300 group-hover:-translate-y-1"
                    strokeWidth={1.25}
                    aria-hidden="true"
                  />
                  <span className="font-label text-[18px] text-text-100">Carregar mapa</span>
                  <span className="max-w-[34ch] text-[13px] text-text-400">
                    O mapa é do Google e só carrega depois do seu clique, para proteger sua privacidade.
                  </span>
                </span>
              </button>
            )}
          </RevealItem>

          <RevealItem className="glass flex flex-col p-6 sm:p-8">
            <div className="flex gap-4">
              <MapPin className="mt-1 size-5 shrink-0 text-gold-500" strokeWidth={1.5} aria-hidden="true" />
              <div>
                <h3 className="font-label text-[16px] text-text-400">Endereço</h3>
                <address className="mt-1 text-[16px] not-italic leading-relaxed text-text-100">
                  <PlaceholderText value={s.address.street} />
                  <br />
                  <PlaceholderText value={s.address.district} /> · {s.address.city}/{s.address.state}
                </address>
              </div>
            </div>
            <div className="stitch my-6" role="presentation" />
            <div className="flex gap-4">
              <Clock className="mt-1 size-5 shrink-0 text-gold-500" strokeWidth={1.5} aria-hidden="true" />
              <div className="flex-1">
                <h3 className="font-label text-[16px] text-text-400">Horário de funcionamento</h3>
                <dl className="mt-2 space-y-1.5">
                  {s.openingHours.map((h) => (
                    <div key={h.days} className="flex justify-between gap-4 text-[16px]">
                      <dt className="text-text-100">{h.days}</dt>
                      <dd className="tabular text-text-400">{h.hours}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>
            <div className="mt-8 grid gap-2 sm:grid-cols-2">
              <a
                href={waLink(s.whatsapp, 'Olá! Vim pelo site da Classe A.')}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass('primary', 'md')}
              >
                <WhatsAppIcon className="size-5" />
                WhatsApp
              </a>
              {!isPlaceholder(s.instagram) && (
                <a
                  href={`https://instagram.com/${s.instagram}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClass('secondary', 'md')}
                >
                  <InstagramIcon className="size-5" />
                  Instagram
                </a>
              )}
              <a
                href={mapsUrl(s)}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass('ghost', 'md', 'sm:col-span-2')}
              >
                <Navigation className="size-4" strokeWidth={1.5} />
                Como chegar
              </a>
            </div>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  );
}
