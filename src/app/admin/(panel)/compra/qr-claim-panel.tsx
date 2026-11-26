'use client';
import { useEffect, useRef, useState, useTransition } from 'react';
import QRCode from 'qrcode';
import { toast } from 'sonner';
import { CheckCircle2, Clock, Minus, Plus, QrCode, RotateCcw, X } from 'lucide-react';
import { cancelStampClaim, createStampClaim, getStampClaimStatus } from '@/server/admin-actions';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';

type Claim = { id: string; token: string; expires_at: string; stamps: number };
type Phase = 'form' | 'showing' | 'claimed' | 'expired';

/** El cajero genera un QR de un solo uso; el cliente lo escanea con su teléfono. */
export function QrClaimPanel({ limit, currency }: { limit: number; currency: string }) {
  const [stamps, setStamps] = useState(1);
  const [amount, setAmount] = useState('');
  const [claim, setClaim] = useState<Claim | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('form');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [customer, setCustomer] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const polling = useRef(false);

  const generate = () =>
    start(async () => {
      const res = await createStampClaim(stamps, amount);
      if (!res.ok || !res.data) {
        toast.error(res.ok ? 'No se pudo generar el código.' : res.error);
        return;
      }
      const url = `${window.location.origin}/s/${res.data.token}`;
      setQr(await QRCode.toDataURL(url, { width: 560, margin: 1, color: { dark: '#241810', light: '#FFFFFF' } }));
      setClaim(res.data);
      setCustomer(null);
      setPhase('showing');
    });

  // Cuenta regresiva y consulta del estado mientras el QR está visible
  useEffect(() => {
    if (phase !== 'showing' || !claim) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.round((new Date(claim.expires_at).getTime() - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    const poll = setInterval(async () => {
      if (polling.current) return;
      polling.current = true;
      const res = await getStampClaimStatus(claim.id);
      polling.current = false;
      if (!res.ok || !res.data) return;
      if (res.data.status === 'claimed') {
        setCustomer(res.data.customer_name);
        setPhase('claimed');
        toast.success(`Sello entregado a ${res.data.customer_name ?? 'el cliente'}`);
      } else if (res.data.status === 'expired' || res.data.status === 'cancelled') {
        setPhase('expired');
      }
    }, 2000);
    return () => {
      clearInterval(timer);
      clearInterval(poll);
    };
  }, [phase, claim]);

  const reset = () => {
    setClaim(null);
    setQr(null);
    setAmount('');
    setStamps(1);
    setPhase('form');
  };

  if (phase === 'form')
    return (
      <div className="grid gap-6 rounded-2xl border border-line bg-surface p-5 shadow-card sm:grid-cols-[1fr_260px] animate-rise">
        <div className="space-y-4">
          <div>
            <p className="font-semibold">Cobrar con QR</p>
            <p className="mt-1 text-sm text-ink-muted">Genera un código de un solo uso. El cliente lo escanea con la cámara de su teléfono y el sello se suma a su tarjeta automáticamente.</p>
          </div>
          <div>
            <span className="text-[13px] font-medium">Sellos</span>
            <div className="mt-1.5 flex items-center gap-3">
              <Button type="button" variant="secondary" size="lg" className="w-12 px-0" onClick={() => setStamps((s) => Math.max(1, s - 1))} disabled={stamps <= 1} aria-label="Menos sellos"><Minus className="size-4" /></Button>
              <output className="tabular w-10 text-center text-2xl font-semibold">{stamps}</output>
              <Button type="button" variant="secondary" size="lg" className="w-12 px-0" onClick={() => setStamps((s) => Math.min(limit, s + 1))} disabled={stamps >= limit} aria-label="Más sellos"><Plus className="size-4" /></Button>
            </div>
          </div>
          <Field label="Importe de la compra" htmlFor="qr-amount" optional hint={`En ${currency}.`}>
            <Input id="qr-amount" type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
          </Field>
          <Button variant="brand" size="lg" className="w-full" loading={pending} onClick={generate}>
            <QrCode className="size-4" /> Generar QR (+{stamps})
          </Button>
        </div>
        <ul className="space-y-3 rounded-xl bg-cream-50 p-4 text-xs text-ink-soft ring-1 ring-line">
          <li>✓ Válido 2 minutos y para un solo cliente.</li>
          <li>✓ Una foto o captura no sirve después de usarse.</li>
          <li>✓ El sello queda registrado a tu nombre.</li>
          <li>✓ Si el cliente no tiene tarjeta, se registra al escanear y recibe su sello.</li>
        </ul>
      </div>
    );

  return (
    <div className="rounded-2xl border border-line bg-surface p-6 text-center shadow-card animate-rise">
      {phase === 'showing' && qr && (
        <>
          <p className="text-sm font-medium text-ink-muted">Pide al cliente que escanee con la cámara de su teléfono</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Código QR de sello" className="mx-auto mt-4 aspect-square w-full max-w-[320px] rounded-2xl border border-line bg-white p-3" />
          <p className="mt-4 text-lg font-semibold">+{claim?.stamps} {claim?.stamps === 1 ? 'sello' : 'sellos'}</p>
          <p className="tabular mt-1 inline-flex items-center gap-1.5 text-sm text-ink-muted">
            <Clock className="size-4" /> Caduca en {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}
          </p>
          <div className="mt-5">
            <Button variant="ghost" onClick={() => { if (claim) cancelStampClaim(claim.id); reset(); }}><X className="size-4" /> Cancelar</Button>
          </div>
        </>
      )}
      {phase === 'claimed' && (
        <div className="py-8">
          <CheckCircle2 className="mx-auto size-16 text-success animate-stamp" />
          <p className="mt-4 text-xl font-semibold">¡Sello entregado!</p>
          <p className="mt-1 text-sm text-ink-muted">{customer ?? 'El cliente'} recibió +{claim?.stamps} en su tarjeta.</p>
          <Button className="mt-6" variant="brand" size="lg" onClick={reset}><QrCode className="size-4" /> Siguiente cliente</Button>
        </div>
      )}
      {phase === 'expired' && (
        <div className="py-8">
          <Clock className="mx-auto size-12 text-warning" />
          <p className="mt-4 text-lg font-semibold">El código caducó sin usarse</p>
          <Button className="mt-6" variant="brand" onClick={generate} loading={pending}><RotateCcw className="size-4" /> Generar otro</Button>
          <div className="mt-2"><Button variant="ghost" onClick={reset}>Volver</Button></div>
        </div>
      )}
    </div>
  );
}
