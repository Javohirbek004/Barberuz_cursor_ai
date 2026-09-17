CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  username text NOT NULL UNIQUE,
  brand_name text,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT 'barber',
  mode text NOT NULL DEFAULT 'solo',
  lang text NOT NULL DEFAULT 'uz',
  phone text,
  phone_visible boolean NOT NULL DEFAULT true,
  telegram_verified boolean NOT NULL DEFAULT false,
  telegram_id text,
  telegram_username text,
  working_hours_start text,
  working_hours_end text,
  bio text,
  avatar_url text,
  specializations text,
  schedule_json text,
  lunch_break_enabled boolean NOT NULL DEFAULT false,
  lunch_break_start text,
  lunch_break_end text,
  address text,
  map_link text,
  latitude text,
  longitude text,
  instagram text,
  gallery_images text,
  notif_new_booking boolean NOT NULL DEFAULT true,
  notif_cancellation boolean NOT NULL DEFAULT true,
  notif_reminders boolean NOT NULL DEFAULT true,
  notif_reminder_minutes text NOT NULL DEFAULT '30',
  slug_changed_at timestamptz,
  slug_change_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS users_phone_idx ON users (phone);
CREATE INDEX IF NOT EXISTS users_telegram_id_idx ON users (telegram_id);

CREATE TABLE IF NOT EXISTS clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone text,
  telegram_id text,
  notes text,
  status text NOT NULL DEFAULT 'new',
  visit_count integer NOT NULL DEFAULT 0,
  total_spent numeric(10, 2) NOT NULL DEFAULT '0',
  last_visit timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS service_categories_barber_id_idx ON service_categories (barber_id);

CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  name_ru text,
  category_id uuid REFERENCES service_categories(id) ON DELETE SET NULL,
  duration integer NOT NULL DEFAULT 30,
  price numeric(10, 2) NOT NULL DEFAULT '0',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS services_barber_id_idx ON services (barber_id);

CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  client_name text NOT NULL,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  service_name text,
  date date NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  booking_time timestamptz,
  price numeric(10, 2) NOT NULL DEFAULT '0',
  status text NOT NULL DEFAULT 'confirmed',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS bookings_barber_id_idx ON bookings (barber_id);
CREATE INDEX IF NOT EXISTS bookings_client_id_idx ON bookings (client_id);
CREATE INDEX IF NOT EXISTS bookings_booking_time_idx ON bookings (booking_time);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings (status);

CREATE TABLE IF NOT EXISTS booking_sessions (
  session_id text PRIMARY KEY,
  barber_id text NOT NULL,
  booking_data text NOT NULL,
  client_telegram_id text,
  client_name text,
  client_telegram_username text,
  booking_id text,
  client_phone text,
  notification_sent boolean NOT NULL DEFAULT false,
  cancel_notification_sent boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS booking_sessions_status_idx ON booking_sessions (status);
CREATE INDEX IF NOT EXISTS booking_sessions_barber_id_idx ON booking_sessions (barber_id);
CREATE INDEX IF NOT EXISTS booking_sessions_expires_idx ON booking_sessions (expires_at);

CREATE TABLE IF NOT EXISTS slug_redirects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  old_slug text NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS slug_redirects_old_slug_idx ON slug_redirects (old_slug);
CREATE INDEX IF NOT EXISTS slug_redirects_user_id_idx ON slug_redirects (user_id);

CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title text NOT NULL,
  amount numeric(10, 2) NOT NULL,
  category text NOT NULL DEFAULT 'Boshqa',
  date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expenses_barber_id_idx ON expenses (barber_id);
CREATE INDEX IF NOT EXISTS expenses_date_idx ON expenses (date);

CREATE TABLE IF NOT EXISTS expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (barber_id, name)
);
CREATE INDEX IF NOT EXISTS expense_categories_barber_id_idx ON expense_categories (barber_id);
