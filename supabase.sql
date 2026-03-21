-- ================================================================
-- SALOM - SCHEMA COMPLETO SUPABASE
-- Execute este arquivo no SQL Editor do Supabase Dashboard
-- ================================================================

-- Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- TABELA: profiles (estende auth.users)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  name        TEXT,
  email       TEXT,
  phone       TEXT,
  avatar_url  TEXT,
  role        TEXT DEFAULT 'client' CHECK (role IN ('owner', 'employee', 'client')),
  permissions JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- MIGRAÇÃO ANTECIPADA: Converter role de ENUM para TEXT
-- Deve rodar ANTES das policies que usam role IN ('owner','employee'),
-- senão o PostgreSQL tenta cast 'owner' → user_role ENUM e falha (22P02).
-- IMPORTANTE: O PostgreSQL bloqueia ALTER COLUMN TYPE se QUALQUER policy
-- em QUALQUER tabela do schema referenciar essa coluna (mesmo indiretamente,
-- como EXISTS (SELECT 1 FROM profiles WHERE role = ...)).
-- Solução: dropar TODAS as policies do schema public antes de alterar.
-- ================================================================
DO $$
DECLARE
  v_col_type text;
  v_pol      record;
BEGIN
  SELECT pg_catalog.format_type(a.atttypid, a.atttypmod)
  INTO   v_col_type
  FROM   pg_catalog.pg_attribute a
  JOIN   pg_catalog.pg_class     c ON c.oid = a.attrelid
  JOIN   pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  WHERE  n.nspname = 'public'
    AND  c.relname = 'profiles'
    AND  a.attname = 'role'
    AND  a.attnum  > 0
    AND  NOT a.attisdropped;

  IF v_col_type IS NOT NULL
     AND lower(v_col_type) NOT IN ('text', 'character varying') THEN

    -- Derrubar TODAS as policies de TODAS as tabelas do schema public.
    -- Policies em outras tabelas (clients, tickets, providers, etc.) que fazem
    -- EXISTS (SELECT 1 FROM profiles WHERE role = ...) também bloqueiam ALTER COLUMN.
    FOR v_pol IN
      SELECT schemaname, tablename, policyname
      FROM   pg_policies
      WHERE  schemaname = 'public'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
        v_pol.policyname, v_pol.schemaname, v_pol.tablename);
    END LOOP;

    EXECUTE 'ALTER TABLE public.profiles ALTER COLUMN role DROP DEFAULT';
    EXECUTE 'ALTER TABLE public.profiles ALTER COLUMN role TYPE text USING role::text';
    EXECUTE 'ALTER TABLE public.profiles ALTER COLUMN role SET DEFAULT ''client''';
  END IF;
END;
$$;

-- Garantir constraint correta (TEXT com os 3 papéis)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('owner', 'employee', 'client'));

-- Migrar registros antigos 'admin' → 'employee'
UPDATE public.profiles SET role = 'employee' WHERE role = 'admin';

-- Adicionar coluna de permissões (segura para re-executar)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{}';

DROP POLICY IF EXISTS "profiles_select_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"   ON public.profiles;
DROP POLICY IF EXISTS "profiles_admin_select" ON public.profiles;
CREATE POLICY "profiles_select_own"   ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_update_own"   ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own"   ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_admin_select" ON public.profiles FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'employee')));

-- Trigger: criar perfil automaticamente ao registrar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ================================================================
-- TABELA: softwares
-- ================================================================
CREATE TABLE IF NOT EXISTS public.softwares (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  version     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.softwares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "softwares_authenticated" ON public.softwares;
CREATE POLICY "softwares_authenticated" ON public.softwares FOR ALL USING (auth.role() = 'authenticated');

-- ================================================================
-- TABELA: clients
-- ================================================================
CREATE TABLE IF NOT EXISTS public.clients (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name       TEXT NOT NULL,
  type       TEXT DEFAULT 'pessoal' CHECK (type IN ('pessoal', 'empresa')),
  phone      TEXT,
  email      TEXT,
  address    TEXT,
  notes      TEXT,
  user_id    UUID REFERENCES auth.users ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "clients_admin_all"  ON public.clients;
DROP POLICY IF EXISTS "clients_select_own" ON public.clients;
CREATE POLICY "clients_admin_all"   ON public.clients FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'employee')));
CREATE POLICY "clients_select_own"  ON public.clients FOR SELECT USING (user_id = auth.uid());

-- ================================================================
-- TABELA: tickets (chamados internos + chamados de clientes)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.tickets (
  id             SERIAL PRIMARY KEY,
  task           TEXT NOT NULL,
  software_id    UUID REFERENCES public.softwares ON DELETE SET NULL,
  client_id      UUID REFERENCES public.clients ON DELETE SET NULL,
  type           TEXT DEFAULT 'desenvolvimento' CHECK (type IN ('bug', 'desenvolvimento', 'atendimento')),
  status         TEXT DEFAULT 'não iniciado'
                   CHECK (status IN ('não iniciado', 'em andamento', 'pendente', 'suspenso', 'cancelado', 'concluído')),
  observation    TEXT,
  responsible_id UUID REFERENCES public.profiles ON DELETE SET NULL,
  deadline       DATE,
  cost           DECIMAL(12,2),
  custom_data    JSONB DEFAULT '{}',
  source         TEXT DEFAULT 'admin' CHECK (source IN ('admin', 'client')),
  parent_id      INTEGER REFERENCES public.tickets ON DELETE SET NULL,
  created_by     UUID REFERENCES auth.users ON DELETE SET NULL DEFAULT auth.uid(),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tickets_admin_all"     ON public.tickets;
DROP POLICY IF EXISTS "tickets_client_select" ON public.tickets;
DROP POLICY IF EXISTS "tickets_client_insert" ON public.tickets;
CREATE POLICY "tickets_admin_all"     ON public.tickets FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'employee')));
CREATE POLICY "tickets_client_select" ON public.tickets FOR SELECT
  USING (
    client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    OR created_by = auth.uid()
  );
CREATE POLICY "tickets_client_insert" ON public.tickets FOR INSERT
  WITH CHECK (source = 'client' AND created_by = auth.uid());

-- Trigger: atualiza updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tickets_updated_at ON public.tickets;
CREATE TRIGGER tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ================================================================
-- TABELA: ticket_columns (colunas personalizadas)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.ticket_columns (
  id        UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name      TEXT NOT NULL,
  col_key   TEXT NOT NULL UNIQUE,
  data_type TEXT DEFAULT 'string' CHECK (data_type IN ('string', 'integer', 'date', 'money')),
  visible   BOOLEAN DEFAULT TRUE,
  position  INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ticket_columns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ticket_columns_authenticated" ON public.ticket_columns;
CREATE POLICY "ticket_columns_authenticated" ON public.ticket_columns FOR ALL
  USING (auth.role() = 'authenticated');

-- ================================================================
-- TABELA: contracts
-- ================================================================
CREATE TABLE IF NOT EXISTS public.contracts (
  id          UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title       TEXT NOT NULL,
  client_id   UUID REFERENCES public.clients ON DELETE SET NULL,
  file_url    TEXT,
  file_name   TEXT,
  file_path   TEXT,
  start_date  DATE,
  end_date    DATE,
  value       DECIMAL(12,2),
  status      TEXT DEFAULT 'ativo' CHECK (status IN ('ativo', 'expirado', 'pendente', 'cancelado')),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contracts_admin_all"     ON public.contracts;
DROP POLICY IF EXISTS "contracts_client_select" ON public.contracts;
CREATE POLICY "contracts_admin_all"    ON public.contracts FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'employee')));
CREATE POLICY "contracts_client_select" ON public.contracts FOR SELECT
  USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

-- ================================================================
-- TABELA: notifications
-- ================================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id         UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users ON DELETE CASCADE NOT NULL,
  title      TEXT NOT NULL,
  message    TEXT,
  is_read    BOOLEAN DEFAULT FALSE,
  ticket_id  INTEGER REFERENCES public.tickets ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notifications_own" ON public.notifications;
CREATE POLICY "notifications_own" ON public.notifications FOR ALL USING (user_id = auth.uid());

-- ================================================================
-- DADOS INICIAIS DE EXEMPLO
-- ================================================================
INSERT INTO public.softwares (name, description, version) VALUES
  ('Salom CRM', 'Sistema de gestão de relacionamento com clientes', '1.0.0'),
  ('Salom ERP', 'Sistema de gestão empresarial integrado', '2.1.0'),
  ('Salom Site', 'Website institucional corporativo', '1.5.0')
ON CONFLICT DO NOTHING;

-- ================================================================
-- STORAGE BUCKETS (configure no Dashboard do Supabase em Storage)
-- ================================================================
-- 1. Criar bucket "avatars"     → público (Public bucket)
-- 2. Criar bucket "contracts"   → privado (Private bucket)
--
-- Policies para o bucket "avatars":
--   INSERT: (bucket_id = 'avatars') AND (auth.uid()::text = (storage.foldername(name))[1])
--   SELECT: bucket_id = 'avatars'
--   UPDATE: (bucket_id = 'avatars') AND (auth.uid()::text = (storage.foldername(name))[1])
--   DELETE: (bucket_id = 'avatars') AND (auth.uid()::text = (storage.foldername(name))[1])
--
-- Policies para o bucket "contracts":
--   INSERT: EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
--   SELECT: EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','client'))
--   DELETE: EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')

-- ================================================================
-- CRIAÇÃO DO USUÁRIO OWNER: salom@admin.com
-- ================================================================
DO $$
DECLARE
  v_uid UUID;
BEGIN
  -- Verificar se já existe
  SELECT id INTO v_uid FROM auth.users WHERE email = 'salom@admin.com';

  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password,
      email_confirmed_at, aud, role,
      raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at,
      confirmation_token, recovery_token
    ) VALUES (
      v_uid,
      '00000000-0000-0000-0000-000000000000',
      'salom@admin.com',
      crypt('.S4l1282026', gen_salt('bf')),
      NOW(), 'authenticated', 'authenticated',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"name":"Salom"}'::jsonb,
      NOW(), NOW(), '', ''
    );
  END IF;

  -- EXECUTE é obrigatório aqui: o Supabase compila todos os DO blocks antes
  -- de executar qualquer um, então um INSERT estático com 'owner' seria
  -- validado contra o tipo ENUM antes da migração rodar.
  -- Com EXECUTE, a validação acontece em runtime (coluna já é TEXT).
  EXECUTE '
    INSERT INTO public.profiles (id, email, name, role, permissions)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (id) DO UPDATE
      SET role = $4,
          name = COALESCE(NULLIF(public.profiles.name, ''''), $3)
  ' USING v_uid, 'salom@admin.com', 'Salom', 'owner', '{}'::jsonb;
END;
$$;
