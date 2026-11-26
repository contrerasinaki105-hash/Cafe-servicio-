'use client';
import { useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { CameraOff } from 'lucide-react';

/** Lector de QR con la cámara del dispositivo (sin instalar apps). */
export function QrScanner({ onResult }: { onResult: (text: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const done = useRef(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let frame = 0;
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Este navegador no permite usar la cámara. Escribe el teléfono del cliente.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
        if (cancelled) return;
        const video = videoRef.current!;
        video.srcObject = stream;
        await video.play();
        tick();
      } catch {
        setError('No se pudo acceder a la cámara. Revisa los permisos del navegador.');
      }
    }

    function tick() {
      if (cancelled || done.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        const w = (canvas.width = video.videoWidth);
        const h = (canvas.height = video.videoHeight);
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(video, 0, 0, w, h);
          const code = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' });
          if (code?.data) {
            done.current = true;
            onResult(code.data);
            return;
          }
        }
      }
      frame = requestAnimationFrame(tick);
    }

    start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onResult]);

  if (error)
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-ink-muted">
        <CameraOff className="size-8 text-coffee-500" />
        {error}
      </div>
    );
  return (
    <div className="relative overflow-hidden rounded-xl bg-espresso-900">
      <video ref={videoRef} className="aspect-square w-full object-cover" playsInline muted />
      <div className="pointer-events-none absolute inset-[18%] rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      <canvas ref={canvasRef} className="hidden" />
      <p className="absolute inset-x-0 bottom-3 text-center text-xs text-white/85">Apunta al código QR de la tarjeta del cliente</p>
    </div>
  );
}
