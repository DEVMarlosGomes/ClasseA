import { Camera, ChevronRight, Download, LogOut, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { brPhoneSchema } from '@shared/schemas';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, MaskedInput } from '@/components/ui/Input';
import { Sheet } from '@/components/ui/Sheet';
import { Switch } from '@/components/ui/Switch';
import { toast } from '@/components/ui/Toast';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { call, errorMessage } from '@/lib/api';
import { formatInstant, formatPhone } from '@/lib/dates';
import { loadAuth, loadFirestore } from '@/lib/firebase';
import { uploadImage } from '@/lib/uploadImage';
import { authErrorMessage, useAuth } from '@/features/auth/AuthProvider';
import { passwordStrength } from '@/features/auth/forms';
import { openCookiePreferences } from '@/features/consent/store';

function Section({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) {
  return (
    <Card tone="panel" className="p-5 sm:p-6">
      <h2 id={id} className="font-label text-[18px] text-text-100">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

function PersonalData() {
  const { user, profile } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setPhone(profile.phone ? formatPhone(profile.phone) : '');
    }
  }, [profile]);

  const save = async () => {
    const e: typeof errors = {};
    if (name.trim().split(/\s+/).length < 2) e.name = 'Informe nome e sobrenome';
    const p = brPhoneSchema.safeParse(phone);
    if (!p.success) e.phone = p.error.issues[0]?.message;
    setErrors(e);
    if (Object.keys(e).length || !user) return;
    setBusy(true);
    try {
      const { db, doc, updateDoc } = await loadFirestore();
      await updateDoc(doc(db, `users/${user.uid}`), { name: name.trim(), phone: p.data });
      toast.success('Dados atualizados.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    if (!user) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 3 * 1024 * 1024) {
      toast.error('Envie uma foto JPG, PNG ou WebP de até 3 MB.');
      return;
    }
    setUploading(true);
    try {
      const url = await uploadImage(`avatars/${user.uid}/avatar`, file);
      const { db, doc, updateDoc } = await loadFirestore();
      await updateDoc(doc(db, `users/${user.uid}`), { avatarUrl: url });
      toast.success('Foto atualizada.');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Section title="Meus dados">
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={name || user?.email || '?'} src={profile?.avatarUrl} size={72} />
        <div>
          <Button
            size="sm"
            variant="secondary"
            loading={uploading}
            icon={<Camera className="size-4" strokeWidth={1.5} />}
            onClick={() => fileRef.current?.click()}
          >
            Trocar foto
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])}
          />
          <p className="mt-1 text-[12px] text-text-400">{user?.email}</p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Nome completo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          autoComplete="name"
        />
        <MaskedInput
          label="Celular com DDD"
          mask="(00) 00000-0000"
          inputMode="tel"
          value={phone}
          onValueChange={setPhone}
          error={errors.phone}
        />
      </div>
      <Button className="mt-5" loading={busy} onClick={save}>
        Salvar dados
      </Button>
    </Section>
  );
}

function PasswordSection() {
  const { user } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const google = user?.providerData.every((p) => p.providerId === 'google.com');
  if (google) return null;
  return (
    <Section title="Senha">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="Senha atual"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <Input
          label="Nova senha"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          hint={next ? `Força: ${passwordStrength(next).label}` : 'Mínimo 8 caracteres'}
        />
      </div>
      <Button
        className="mt-5"
        variant="secondary"
        loading={busy}
        disabled={next.length < 8 || !current}
        onClick={async () => {
          setBusy(true);
          try {
            const { auth, EmailAuthProvider, reauthenticateWithCredential, updatePassword } =
              await loadAuth();
            const u = auth.currentUser!;
            await reauthenticateWithCredential(u, EmailAuthProvider.credential(u.email!, current));
            await updatePassword(u, next);
            setCurrent('');
            setNext('');
            toast.success('Senha alterada.');
          } catch (e) {
            toast.error(authErrorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        Alterar senha
      </Button>
    </Section>
  );
}

function PrivacySection() {
  const { profile } = useAuth();
  const [exporting, setExporting] = useState(false);
  const [marketing, setMarketing] = useState(false);
  useEffect(() => setMarketing(!!profile?.consents?.marketingOptIn), [profile?.consents?.marketingOptIn]);
  const consents = profile?.consents;

  return (
    <Section title="Privacidade" id="privacidade">
      <div className="divide-y divide-white/5">
        <Switch
          className="py-4"
          label="Novidades e promoções"
          description="Receber ofertas da Classe A por e-mail e WhatsApp. Você pode desligar quando quiser."
          checked={marketing}
          onCheckedChange={async (v) => {
            setMarketing(v);
            try {
              await call('setMarketingConsent', { optIn: v });
              toast.success(v ? 'Você vai receber novidades.' : 'Pronto, não enviaremos promoções.');
            } catch (e) {
              setMarketing(!v);
              toast.error(errorMessage(e));
            }
          }}
        />
        <button
          onClick={openCookiePreferences}
          className="flex min-h-14 w-full items-center justify-between py-4 text-left"
        >
          <span>
            <span className="block text-[16px] font-medium text-text-100">Preferências de cookies</span>
            <span className="block text-[14px] text-text-400">
              Escolha o que podemos usar neste navegador.
            </span>
          </span>
          <ChevronRight className="size-5 text-text-400" strokeWidth={1.5} />
        </button>
        <div className="py-4">
          <p className="text-[16px] font-medium text-text-100">Documentos aceitos</p>
          <p className="tabular mt-1 text-[14px] text-text-400">
            Termos de Uso v{consents?.termsVersion ?? '—'} · Política de Privacidade v
            {consents?.privacyVersion ?? '—'}
            {consents?.acceptedAt
              ? ` · aceitos em ${formatInstant(consents.acceptedAt.toDate(), 'dd/MM/yyyy')}`
              : ''}
          </p>
          <div className="mt-2 flex gap-4 text-[14px]">
            <Link to="/termos" className="min-h-11 py-2 text-gold-400 underline">
              Termos
            </Link>
            <Link to="/privacidade" className="min-h-11 py-2 text-gold-400 underline">
              Privacidade
            </Link>
          </div>
        </div>
        <div className="py-4">
          <p className="text-[16px] font-medium text-text-100">Meus dados</p>
          <p className="mt-1 text-[14px] text-text-400">
            Baixe tudo o que guardamos sobre você em um arquivo JSON.
          </p>
          <Button
            className="mt-3"
            size="sm"
            variant="secondary"
            loading={exporting}
            icon={<Download className="size-4" strokeWidth={1.5} />}
            onClick={async () => {
              setExporting(true);
              try {
                const data = await call('exportMyData', {});
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'classe-a-meus-dados.json';
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 1000);
              } catch (e) {
                toast.error(errorMessage(e));
              } finally {
                setExporting(false);
              }
            }}
          >
            Baixar meus dados
          </Button>
        </div>
      </div>
    </Section>
  );
}

function DeleteAccount() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Section title="Excluir conta">
      <p className="text-[14px] leading-relaxed text-text-400">
        Apagamos seu perfil, cartões salvos e as anotações dos barbeiros sobre você, e cancelamos seus
        horários futuros e o plano. Por obrigação legal, guardamos as cobranças por 5 anos, sem seu nome.
      </p>
      <Button className="mt-4" size="sm" variant="danger" onClick={() => setOpen(true)}>
        Excluir minha conta
      </Button>
      <Sheet
        open={open}
        onOpenChange={setOpen}
        title="Excluir conta definitivamente?"
        description="Esta ação não pode ser desfeita."
        size="sm"
        footer={
          <Button
            block
            variant="danger"
            disabled={text !== 'EXCLUIR'}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await call('deleteMyAccount', { confirmation: 'EXCLUIR' });
                await signOut().catch(() => undefined);
                toast.success('Sua conta foi excluída.');
                navigate('/', { replace: true });
              } catch (e) {
                toast.error(errorMessage(e));
                setBusy(false);
              }
            }}
          >
            Excluir para sempre
          </Button>
        }
      >
        <ul className="mb-5 list-disc space-y-1.5 pl-5 text-[14px] text-text-400 marker:text-gold-600">
          <li>Apagados: perfil, foto, cartões, notificações e notas dos barbeiros.</li>
          <li>Cancelados: agendamentos futuros e assinatura.</li>
          <li>Mantidos sem identificação: cobranças (prazo fiscal de 5 anos) e histórico da agenda.</li>
        </ul>
        <Input
          label='Digite "EXCLUIR" para confirmar'
          value={text}
          onChange={(e) => setText(e.target.value.toUpperCase())}
          autoComplete="off"
        />
      </Sheet>
    </Section>
  );
}

export default function ClientProfilePage() {
  useDocumentMeta({ title: 'Perfil', noindex: true });
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <h1 className="font-label text-[36px] leading-tight text-text-100">Perfil</h1>
      <PersonalData />
      <Link to="/cliente/pagamentos" className="panel flex min-h-16 items-center justify-between px-5">
        <span className="flex items-center gap-3 text-[16px] font-medium text-text-100">
          <ShieldCheck className="size-5 text-gold-500" strokeWidth={1.5} />
          Cartões e cobranças
        </span>
        <ChevronRight className="size-5 text-text-400" strokeWidth={1.5} />
      </Link>
      <PasswordSection />
      <PrivacySection />
      <DeleteAccount />
      <Button
        variant="ghost"
        icon={<LogOut className="size-4" strokeWidth={1.5} />}
        onClick={() => void signOut().then(() => navigate('/'))}
        className="md:hidden"
      >
        Sair da conta
      </Button>
    </div>
  );
}
