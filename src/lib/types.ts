export type StaffRole = 'owner' | 'manager' | 'employee';
export type CustomerStatus = 'active' | 'blocked';
export type RedemptionStatus = 'available' | 'redeemed' | 'void' | 'expired';
export type PromotionKind = 'discount' | 'special_reward' | 'temporary' | 'frequent' | 'winback';
export type AudienceSegment = 'all' | 'frequent' | 'inactive' | 'new' | 'near_reward' | 'pending_reward';

export interface Business {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  contact_email: string | null;
  contact_phone: string | null;
  whatsapp: string | null;
  address: string | null;
  city: string | null;
  country_code: string;
  timezone: string;
  currency: string;
  custom_domain: string | null;
  inactive_after_days: number;
  is_active: boolean;
}

export interface PublicBusiness {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  address: string | null;
  city: string | null;
  contact_phone: string | null;
  country_code: string;
  program: { name: string; stamps_required: number; reward_description: string } | null;
  rewards: { name: string; description: string | null; stamps_required: number; image_url: string | null }[];
}

export interface CustomerOverview {
  id: string;
  business_id: string;
  user_id: string | null;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  email: string | null;
  status: CustomerStatus;
  marketing_opt_in: boolean;
  qr_token: string;
  created_at: string;
  visits_count: number;
  total_spent: number;
  last_visit_at: string | null;
  stamp_balance: number;
  lifetime_stamps: number;
  available_rewards: number;
}

export interface LoyaltyProgram {
  id: string;
  business_id: string;
  name: string;
  stamps_required: number;
  reward_description: string;
  max_stamps_per_visit: number;
  cooldown_minutes: number;
  base_reward_id: string | null;
}

export interface Reward {
  id: string;
  business_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  stamps_required: number;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
  max_redemptions_per_customer: number | null;
  max_total_redemptions: number | null;
  created_at: string;
}

export interface RewardRedemption {
  id: string;
  reward_id: string;
  customer_id: string;
  status: RedemptionStatus;
  code: string;
  stamps_cost: number;
  issued_at: string;
  expires_at: string | null;
  redeemed_at: string | null;
  redeemed_by: string | null;
  rewards?: { name: string; image_url: string | null } | null;
}

export interface Promotion {
  id: string;
  business_id: string;
  title: string;
  description: string | null;
  kind: PromotionKind;
  segment: AudienceSegment;
  discount_percent: number | null;
  bonus_stamps: number | null;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
  last_sent_at: string | null;
  recipients_count: number;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

export interface SeriesPoint { period: string; value: number }

export interface DashboardStats {
  timezone: string;
  inactive_after_days: number;
  total_customers: number;
  new_customers_month: number;
  new_customers_prev_month: number;
  total_stamps: number;
  available_rewards: number;
  redeemed_rewards: number;
  total_visits: number;
  visits_month: number;
  visits_prev_month: number;
  revenue_month: number;
  active_customers: number;
  customers_by_month: SeriesPoint[];
  stamps_by_month: SeriesPoint[];
  redemptions_by_month: SeriesPoint[];
  visits_by_week: SeriesPoint[];
  activity_by_hour: { hour: number; value: number }[];
  top_customers: { id: string; name: string; visits: number; spent: number }[];
}

export interface InsightCustomer {
  id: string;
  name: string;
  phone: string;
  created_at: string;
  visits: number;
  recent_visits: number;
  spent: number;
  last_visit: string | null;
  balance: number;
  pending_rewards: number;
}

export interface CustomerInsights {
  period_days: number;
  min_visits: number;
  counts: Record<'frequent' | 'inactive' | 'new' | 'near_reward' | 'pending_reward', number>;
  frequent: InsightCustomer[];
  inactive: InsightCustomer[];
  new: InsightCustomer[];
  near_reward: InsightCustomer[];
  pending_reward: InsightCustomer[];
  top_visits: InsightCustomer[];
  top_spend: InsightCustomer[];
}

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };
