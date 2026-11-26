'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { NewCustomerForm } from './new-customer-form';

export function NewCustomerButton() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <Button variant="brand" onClick={() => setOpen(true)}><UserPlus className="size-4" /> Nuevo cliente</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Nuevo cliente">
        {open && (
          <NewCustomerForm
            onCreated={(id) => {
              setOpen(false);
              router.push(`/admin/clientes/${id}`);
            }}
          />
        )}
      </Modal>
    </>
  );
}
