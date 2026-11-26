import 'server-only';
import { redirect } from 'next/navigation';
import { getCustomerSession, getPublicBusiness } from './customer';

/** Exige una sesión de cliente vinculada a este negocio. */
export async function requireCustomer(slug: string) {
  const business = await getPublicBusiness(slug);
  if (!business) redirect('/');
  const session = await getCustomerSession(business.id);
  if (!session) redirect(`/c/${slug}/entrar`);
  if (!session.customer) redirect(session.isCustomerAccount ? `/c/${slug}/unirse` : `/c/${slug}`);
  return { business, customer: session.customer };
}
