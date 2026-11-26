import Image, { type ImageProps } from 'next/image';

/** Imagen subida por el negocio (Supabase Storage). */
export function RemoteImage(props: ImageProps) {
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image unoptimized {...props} />;
}
