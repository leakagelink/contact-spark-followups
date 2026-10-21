CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  default_country text NOT NULL DEFAULT 'IN',
  followup_template text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TABLE public.import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  source_type text NOT NULL CHECK (source_type IN ('image','pdf','excel','csv','word','text','scan','manual','mixed')),
  source_filename text,
  status text NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','review','completed','failed','cancelled')),
  total_records int NOT NULL DEFAULT 0,
  successful_records int NOT NULL DEFAULT 0,
  duplicate_records int NOT NULL DEFAULT 0,
  failed_records int NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX ON public.import_jobs (user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_jobs TO authenticated;
GRANT ALL ON public.import_jobs TO service_role;
ALTER TABLE public.import_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own jobs" ON public.import_jobs FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  full_name text, first_name text, last_name text,
  phone text, secondary_phone text, whatsapp_phone text,
  email text, secondary_email text,
  address text, city text, state text, country text, postal_code text,
  company text, job_title text, website text, notes text,
  tags text[] NOT NULL DEFAULT '{}',
  source_filename text, source_type text, source_location text,
  import_job_id uuid REFERENCES public.import_jobs(id) ON DELETE SET NULL,
  extraction_confidence numeric,
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified','verified','needs_review')),
  follow_up_status text NOT NULL DEFAULT 'none' CHECK (follow_up_status IN ('none','pending','done')),
  follow_up_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_contacted_at timestamptz,
  CHECK (full_name IS NOT NULL OR phone IS NOT NULL OR email IS NOT NULL)
);
CREATE UNIQUE INDEX contacts_user_phone_uq ON public.contacts (user_id, phone) WHERE phone IS NOT NULL;
CREATE UNIQUE INDEX contacts_user_email_uq ON public.contacts (user_id, lower(email)) WHERE email IS NOT NULL;
CREATE INDEX ON public.contacts (user_id, created_at DESC);
CREATE TRIGGER contacts_touch BEFORE UPDATE ON public.contacts FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contacts TO authenticated;
GRANT ALL ON public.contacts TO service_role;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own contacts" ON public.contacts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.import_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  import_job_id uuid NOT NULL REFERENCES public.import_jobs(id) ON DELETE CASCADE,
  extracted_data jsonb NOT NULL,
  confidence numeric,
  validation_errors jsonb NOT NULL DEFAULT '[]',
  source_location text,
  status text NOT NULL CHECK (status IN ('imported','duplicate','updated','skipped','failed','merged')),
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.import_records (import_job_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.import_records TO authenticated;
GRANT ALL ON public.import_records TO service_role;
ALTER TABLE public.import_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own records" ON public.import_records FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.contact_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN ('call_initiated','whatsapp_opened','whatsapp_skipped','details_shared','note','imported','edited','merged')),
  phone_number text,
  status text,
  metadata jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.contact_activities (user_id, created_at DESC);
CREATE INDEX ON public.contact_activities (contact_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_activities TO authenticated;
GRANT ALL ON public.contact_activities TO service_role;
ALTER TABLE public.contact_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own activities" ON public.contact_activities FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.follow_up_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  activity_id uuid REFERENCES public.contact_activities(id) ON DELETE SET NULL,
  phone_number text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','whatsapp_opened','skipped','done','expired')),
  message_template text,
  due_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE INDEX ON public.follow_up_tasks (user_id, status, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.follow_up_tasks TO authenticated;
GRANT ALL ON public.follow_up_tasks TO service_role;
ALTER TABLE public.follow_up_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own tasks" ON public.follow_up_tasks FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own templates" ON public.message_templates FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());