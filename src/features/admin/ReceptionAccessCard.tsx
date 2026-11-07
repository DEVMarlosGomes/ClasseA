import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { toast } from '@/components/ui/Toast';
import { useLiveQuery } from '@/hooks/useFirestore';
import { call, errorMessage } from '@/lib/api';

interface StaffUser {
  id: string;
  name: string;
  email: string;
}

/** Front-desk accounts: agenda of every barber + "dar baixa", no finance. Created only by the owner. */
export function ReceptionAccessCard() {
  const users = useLiveQuery<StaffUser>('reception-users', ({ db, collection, query, where }) =>
    query(collection(db, 'users'), where('roles', 'array-contains', 'reception')),
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setBusy(true);
    try {
      await call('createReception', { name: name.trim(), email: email.trim().toLowerCase() });
      toast.success('Acesso da recepção criado.', { description: `Enviamos para ${email.trim()} um link para definir a senha.` });
      setName('');
      setEmail('');
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h2 className="font-label text-[22px] text-text-100">Recepção</h2>
        <p className="mt-1 text-[13px] text-text-400">
          Vê a agenda de todos os barbeiros e dá baixa nos pagamentos feitos na barbearia. Não vê faturamento nem comissões.
          Entra em /barbeiro/login.
        </p>
      </div>
      {users.data && users.data.length > 0 && (
        <ul className="space-y-1 text-[14px]">
          {users.data.map((u) => (
            <li key={u.id} className="text-text-100">
              {u.name} <span className="text-text-400">· {u.email}</span>
            </li>
          ))}
        </ul>
      )}
      <form
        className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          void create();
        }}
      >
        <Input label="Nome" value={name} onChange={(e) => setName(e.target.value)} />
        <Input label="E-mail" type="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button type="submit" className="h-14" loading={busy} disabled={name.trim().length < 2 || !email.includes('@')}>
          Criar acesso
        </Button>
      </form>
    </Card>
  );
}
