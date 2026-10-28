import { Camera, LogOut, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ErrorState } from '@/components/ui/EmptyState';
import { Checkbox, Input, Textarea } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { toast } from '@/components/ui/Toast';
import { useDocumentMeta } from '@/hooks/useDocumentMeta';
import { errorMessage } from '@/lib/api';
import { useServices } from '@/lib/catalog';
import { loadFirestore } from '@/lib/firebase';
import { uploadImage } from '@/lib/uploadImage';
import { useAuth } from '@/features/auth/AuthProvider';
import { useMyBarber } from './hooks';

export default function BarberProfilePage() {
  useDocumentMeta({ title: 'Meu perfil', noindex: true });
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const barber = useMyBarber(user?.uid);
  const services = useServices();
  const [bio, setBio] = useState('');
  const [specialties, setSpecialties] = useState<string[]>([]);
  const [newSpec, setNewSpec] = useState('');
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!barber.data) return;
    setBio(barber.data.bio);
    setSpecialties(barber.data.specialties);
    setServiceIds(barber.data.serviceIds);
  }, [barber.data]);

  if (barber.error) return <ErrorState />;
  if (barber.loading || !barber.data) return <Skeleton className="h-96 rounded-[20px]" />;
  const b = barber.data;

  const save = async () => {
    if (!serviceIds.length) return toast.error('Escolha ao menos um serviço que você faz.');
    setSaving(true);
    try {
      const { db, doc, updateDoc } = await loadFirestore();
      await updateDoc(doc(db, `barbers/${b.id}`), { bio: bio.trim().slice(0, 240), specialties, serviceIds });
      toast.success('Perfil atualizado. Já aparece no site e no agendamento.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const upload = async (file: File) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 3 * 1024 * 1024)
      return toast.error('Envie JPG, PNG ou WebP de até 3 MB.');
    setUploading(true);
    try {
      const url = await uploadImage(`barbers/${b.id}/photo`, file);
      const { db, doc, updateDoc } = await loadFirestore();
      await updateDoc(doc(db, `barbers/${b.id}`), { photoUrl: url });
      toast.success('Foto atualizada.');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="font-label text-[36px] leading-tight text-text-100">Meu perfil</h1>
      <Card className="p-5 sm:p-6">
        <div className="flex items-center gap-4">
          <Avatar name={b.displayName} src={b.photoUrl} size={80} />
          <div>
            <p className="font-label text-[24px] text-text-100">{b.displayName}</p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-2"
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
          </div>
        </div>
        <div className="mt-6 space-y-4">
          <Textarea
            label="Bio curta"
            value={bio}
            maxLength={240}
            onChange={(e) => setBio(e.target.value)}
            hint={`${bio.length}/240 · aparece no site`}
          />
          <div>
            <p className="font-label mb-2 text-[12px] text-text-400">Especialidades</p>
            <div className="flex flex-wrap gap-2">
              {specialties.map((s) => (
                <span
                  key={s}
                  className="inline-flex min-h-9 items-center gap-1 rounded-full border border-gold-700 bg-gold-500/10 pl-3 pr-1 text-[14px] text-gold-400"
                >
                  {s}
                  <button
                    onClick={() => setSpecialties((l) => l.filter((x) => x !== s))}
                    className="grid size-7 place-items-center rounded-full hover:bg-gold-500/20"
                    aria-label={`Remover ${s}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const v = newSpec.trim();
                if (v && !specialties.includes(v) && specialties.length < 6) setSpecialties((l) => [...l, v]);
                setNewSpec('');
              }}
            >
              <Input
                label="Nova especialidade"
                value={newSpec}
                onChange={(e) => setNewSpec(e.target.value)}
                wrapperClassName="flex-1"
                maxLength={30}
              />
              <Button type="submit" variant="secondary" className="h-14">
                Adicionar
              </Button>
            </form>
          </div>
          <fieldset>
            <legend className="font-label mb-2 text-[12px] text-text-400">Serviços que você faz</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {services.data?.map((s) => (
                <Checkbox
                  key={s.id}
                  checked={serviceIds.includes(s.id)}
                  onChange={(e) =>
                    setServiceIds((l) => (e.target.checked ? [...l, s.id] : l.filter((x) => x !== s.id)))
                  }
                  label={s.name}
                />
              ))}
            </div>
          </fieldset>
        </div>
        <Button className="mt-6" loading={saving} onClick={() => void save()}>
          Salvar perfil
        </Button>
      </Card>
      <Button
        variant="ghost"
        icon={<LogOut className="size-4" strokeWidth={1.5} />}
        onClick={() => void signOut().then(() => navigate('/barbeiro/login'))}
      >
        Sair
      </Button>
    </div>
  );
}
