import type { StaffRole } from '@/lib/types';

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles: StaffRole[];
}

export const NAV_SECTIONS: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: '/admin', label: 'Dashboard', icon: 'LayoutDashboard', roles: ['owner', 'manager'] },
      { href: '/admin/compra', label: 'Registrar compra', icon: 'ScanLine', roles: ['owner', 'manager', 'employee'] },
      { href: '/admin/clientes', label: 'Clientes', icon: 'Users', roles: ['owner', 'manager', 'employee'] },
    ],
  },
  {
    title: 'Fidelización',
    items: [
      { href: '/admin/sellos', label: 'Sellos', icon: 'Stamp', roles: ['owner', 'manager'] },
      { href: '/admin/recompensas', label: 'Recompensas', icon: 'Gift', roles: ['owner', 'manager'] },
      { href: '/admin/promociones', label: 'Promociones', icon: 'Megaphone', roles: ['owner', 'manager'] },
      { href: '/admin/analisis', label: 'Análisis de clientes', icon: 'LineChart', roles: ['owner', 'manager'] },
    ],
  },
  {
    title: 'Administración',
    items: [
      { href: '/admin/equipo', label: 'Equipo', icon: 'UserCog', roles: ['owner'] },
      { href: '/admin/auditoria', label: 'Registro de actividad', icon: 'ScrollText', roles: ['owner'] },
      { href: '/admin/configuracion', label: 'Configuración', icon: 'Settings', roles: ['owner'] },
    ],
  },
];
