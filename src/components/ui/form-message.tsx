import { AlertCircle, CheckCircle2 } from 'lucide-react';

export function FormMessage({ state }: { state: { ok: boolean; error?: string; message?: string } | null | undefined }) {
  if (!state) return null;
  if (!state.ok && state.error)
    return (
      <div role="alert" className="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger-bg px-3.5 py-2.5 text-sm text-danger animate-fade-in">
        <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{state.error}</span>
      </div>
    );
  if (state.ok && state.message)
    return (
      <div role="status" className="flex items-start gap-2 rounded-xl border border-success/20 bg-success-bg px-3.5 py-2.5 text-sm text-success animate-fade-in">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{state.message}</span>
      </div>
    );
  return null;
}
