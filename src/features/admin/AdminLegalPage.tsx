import { ExternalLink, Save, TriangleAlert } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import type { LegalDocType, LegalDocVersion } from '@shared/types';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { Tabs } from '@/components/ui/Tabs';
import { toast } from '@/components/ui/Toast';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { useLiveDoc } from '@/hooks/useFirestore';
import { errorMessage } from '@/lib/api';
import { loadFirestore } from '@/lib/firebase';

const DOCS: Record<LegalDocType, { label: string; route: string }> = {
  privacy: { label: 'Privacidade', route: '/privacidade' },
  terms: { label: 'Termos', route: '/termos' },
  cookies: { label: 'Cookies', route: '/cookies' },
};

export default function AdminLegalPage() {
  useDocumentMeta({ title: 'Documentos legais', noindex: true });
  const [type, setType] = useState<LegalDocType>('privacy');
  const root = useLiveDoc<{ id: string; currentVersion: string }>(`legalDocs/${type}`);
  const current = root.data?.currentVersion ?? '';
  const version = useLiveDoc<LegalDocVersion>(current ? `legalDocs/${type}/versions/${current}` : null);
  const [nextVersion, setNextVersion] = useState('');
  const [effectiveAt, setEffectiveAt] = useState('');
  const [markdown, setMarkdown] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!version.data) return;
    setNextVersion(version.data.version);
    setEffectiveAt(version.data.effectiveAt);
    setMarkdown(version.data.markdown);
  }, [version.data]);

  const publish = async () => {
    const v = nextVersion.trim();
    if (!/^\d+\.\d+(?:\.\d+)?$/.test(v) || !effectiveAt || markdown.trim().length < 200) return toast.error('Use uma versão como 1.1, informe a vigência e revise o texto.');
    setSaving(true);
    try {
      const { db, doc, writeBatch } = await loadFirestore();
      const batch = writeBatch(db);
      batch.set(doc(db, `legalDocs/${type}/versions/${v}`), { version: v, effectiveAt, markdown: markdown.trim() });
      batch.set(doc(db, `legalDocs/${type}`), { currentVersion: v }, { merge: true });
      batch.update(doc(db, 'settings/shop'), { [`currentLegalVersions.${type}`]: v });
      await batch.commit();
      toast.success('Nova versão publicada.', { description: type === 'cookies' ? 'A central de cookies pedirá nova escolha.' : 'Usuários logados receberão a solicitação de novo aceite.' });
    } catch (e) { toast.error(errorMessage(e)); } finally { setSaving(false); }
  };

  const loading = root.loading || version.loading;
  return (
    <div className="space-y-6">
      <div><p className="font-label text-[12px] tracking-[0.16em] text-gold-500">LGPD</p><h1 className="font-label mt-1 text-[36px] leading-tight text-text-100">Documentos legais</h1><p className="mt-1 text-[14px] text-text-400">Edite e versione as minutas exibidas publicamente.</p></div>
      <div role="alert" className="flex gap-3 rounded-[16px] border border-gold-700 bg-gold-500/10 p-4 text-[14px] text-gold-400"><TriangleAlert className="mt-0.5 size-5 shrink-0" /><p>As minutas precisam de revisão jurídica e dos dados reais da barbearia antes da publicação.</p></div>
      <Tabs value={type} onValueChange={(v) => setType(v as LegalDocType)} items={Object.entries(DOCS).map(([value, d]) => ({ value, label: d.label }))} />
      {loading ? <Skeleton className="h-[600px] rounded-[20px]" /> : <Card className="p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[13px] text-text-400">Versão publicada</p><p className="font-label text-[22px] text-text-100">{current || 'Nenhuma'}</p></div><Link to={DOCS[type].route} target="_blank" className="inline-flex min-h-11 items-center gap-2 px-3 text-[14px] text-gold-400">Ver página pública <ExternalLink className="size-4" /></Link></div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Input label="Nova versão" value={nextVersion} onChange={(e) => setNextVersion(e.target.value)} hint="Ex.: 1.1. Alterar a versão registra um novo aceite." /><Input label="Data de vigência" type="date" value={effectiveAt} onChange={(e) => setEffectiveAt(e.target.value)} /></div><div className="mt-4"><Textarea label="Conteúdo em Markdown" value={markdown} onChange={(e) => setMarkdown(e.target.value)} className="min-h-[460px] font-mono text-[14px]" hint={`${markdown.length.toLocaleString('pt-BR')} caracteres`} /></div><Button className="mt-5" size="lg" icon={<Save className="size-4" />} loading={saving} onClick={() => void publish()}>Publicar versão</Button></Card>}
    </div>
  );
}
