import { notFound, redirect } from 'next/navigation';
import { requireStaff } from '@/lib/auth/staff';
import { createClient } from '@/lib/supabase/server';
import { EmptyState } from '@/components/ui/empty-state';
import { UserX } from 'lucide-react';

/** Destino del QR personal del cliente al escanearlo con la cámara del teléfono del personal. */
export default async function ScanCustomerPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{24}$/i.test(token)) notFound();
  const ctx = await requireStaff();
  const supabase = await createClient();
  const { data } = await supabase
    .from('customers')
    .select('id')
    .eq('business_id', ctx.business.id)
    .eq('qr_token', token.toLowerCase())
    .maybeSingle();
  if (data) redirect(`/admin/compra?cliente=${data.id}`);
  return (
    <div className="rounded-2xl border border-line bg-surface">
      <EmptyState icon={UserX} title="Cliente no encontrado" description={`Este código no pertenece a un cliente de ${ctx.business.name}.`} />
    </div>
  );
}
