'use client';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { SeriesPoint } from '@/lib/types';

const INK = '#8a7768';
const GRID = '#efe7db';
const SERIES = '#6f4e37';
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function monthLabel(period: string) {
  const [y, m] = period.split('-');
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
}
function weekLabel(period: string) {
  const [, m, d] = period.split('-');
  return `${Number(d)} ${MONTHS[Number(m) - 1]}`;
}

function ChartTooltip({ active, payload, label, unit }: { active?: boolean; payload?: { value: number }[]; label?: string; unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-xs shadow-pop">
      <p className="text-ink-muted">{label}</p>
      <p className="tabular mt-0.5 text-sm font-semibold text-ink">
        {payload[0].value.toLocaleString('es-MX')} {unit}
      </p>
    </div>
  );
}

const axisProps = { tick: { fill: INK, fontSize: 11 }, tickLine: false, axisLine: false } as const;

export function TrendChart({ data, kind, unit, granularity = 'month' }: { data: SeriesPoint[]; kind: 'area' | 'bar'; unit: string; granularity?: 'month' | 'week' }) {
  const rows = data.map((d) => ({ label: granularity === 'month' ? monthLabel(d.period) : weekLabel(d.period), value: Number(d.value) }));
  const empty = rows.every((r) => r.value === 0);
  return (
    <div className="relative h-56 w-full" role="img" aria-label={`Gráfico de ${unit}`}>
      {empty && <p className="absolute inset-0 z-10 grid place-items-center text-sm text-ink-muted">Aún no hay datos en este periodo</p>}
      <ResponsiveContainer width="100%" height="100%">
        {kind === 'area' ? (
          <AreaChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES} stopOpacity={0.22} />
                <stop offset="100%" stopColor={SERIES} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" {...axisProps} />
            <YAxis allowDecimals={false} {...axisProps} width={44} />
            <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ stroke: '#d9cab6', strokeDasharray: '3 3' }} />
            <Area type="monotone" dataKey="value" stroke={SERIES} strokeWidth={2} fill="url(#fill)" activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} />
          </AreaChart>
        ) : (
          <BarChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} {...axisProps} width={44} />
            <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: '#f7f2ea' }} />
            <Bar dataKey="value" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={36} />
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

export function HourChart({ data }: { data: { hour: number; value: number }[] }) {
  const rows = data.map((d) => ({ label: `${String(d.hour).padStart(2, '0')}h`, value: Number(d.value) }));
  const max = Math.max(...rows.map((r) => r.value));
  return (
    <div className="relative h-56 w-full" role="img" aria-label="Visitas por hora del día">
      {max === 0 && <p className="absolute inset-0 z-10 grid place-items-center text-sm text-ink-muted">Aún no hay visitas registradas</p>}
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={GRID} />
          <XAxis dataKey="label" {...axisProps} interval={2} />
          <YAxis allowDecimals={false} {...axisProps} width={44} />
          <Tooltip content={<ChartTooltip unit="visitas" />} cursor={{ fill: '#f7f2ea' }} />
          <Bar dataKey="value" fill={SERIES} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
