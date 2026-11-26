import { redirect } from 'next/navigation';

export default function NoAccessPage() {
  redirect('/admin/login?acceso=1');
}
