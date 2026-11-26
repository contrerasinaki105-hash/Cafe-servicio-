import type { AudienceSegment, PromotionKind } from './types';

export const PROMOTION_KINDS: Record<PromotionKind, string> = {
  discount: 'Descuento',
  special_reward: 'Recompensa especial',
  temporary: 'Promoción temporal',
  frequent: 'Beneficio para frecuentes',
  winback: 'Campaña para inactivos',
};

export const SEGMENTS: Record<AudienceSegment, string> = {
  all: 'Todos los clientes',
  frequent: 'Clientes frecuentes',
  inactive: 'Clientes inactivos',
  new: 'Clientes nuevos',
  near_reward: 'Cerca de una recompensa',
  pending_reward: 'Con recompensa pendiente',
};
