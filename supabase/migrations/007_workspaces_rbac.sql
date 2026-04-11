-- Workspaces & RBAC: Multi-tenant workspace model
-- Run after 006_habits_goals.sql

-- =============================================================================
-- 1. workspaces
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  logo_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_personal BOOLEAN DEFAULT false,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_slug ON public.workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_workspaces_created_by ON public.workspaces(created_by);

-- =============================================================================
-- 2. workspace_members
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON public.workspace_members(user_id);

-- =============================================================================
-- 3. workspace_invitations
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.workspace_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin', 'editor', 'viewer')),
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  token TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_invitations_token ON public.workspace_invitations(token);
CREATE INDEX IF NOT EXISTS idx_workspace_invitations_email ON public.workspace_invitations(email);

-- =============================================================================
-- 4. Helper function: check workspace access
-- =============================================================================
CREATE OR REPLACE FUNCTION public.user_has_workspace_access(ws_id UUID, min_role TEXT DEFAULT 'viewer')
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = ws_id
    AND user_id = auth.uid()
    AND (
      CASE min_role
        WHEN 'viewer' THEN role IN ('owner', 'admin', 'editor', 'viewer')
        WHEN 'editor' THEN role IN ('owner', 'admin', 'editor')
        WHEN 'admin'  THEN role IN ('owner', 'admin')
        WHEN 'owner'  THEN role = 'owner'
        ELSE false
      END
    )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================================================
-- 5. Add workspace_id to existing tables
-- =============================================================================
ALTER TABLE public.work_entries ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.reminders ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.timer_sessions ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.daily_motivations ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.habits ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.tags ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

-- Indexes for workspace_id on all tables
CREATE INDEX IF NOT EXISTS idx_work_entries_workspace ON public.work_entries(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tasks_workspace ON public.tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_reminders_workspace ON public.reminders(workspace_id);
CREATE INDEX IF NOT EXISTS idx_timer_sessions_workspace ON public.timer_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_daily_motivations_workspace ON public.daily_motivations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_habits_workspace ON public.habits(workspace_id);
CREATE INDEX IF NOT EXISTS idx_goals_workspace ON public.goals(workspace_id);
CREATE INDEX IF NOT EXISTS idx_tags_workspace ON public.tags(workspace_id);

-- =============================================================================
-- 6. Data migration: create personal workspaces for existing users
-- =============================================================================
-- This creates a personal workspace for each user who has a profile,
-- then backfills workspace_id on all their existing rows.
DO $$
DECLARE
  u RECORD;
  ws_id UUID;
BEGIN
  FOR u IN SELECT user_id, name FROM public.user_profiles LOOP
    -- Create personal workspace
    INSERT INTO public.workspaces (name, slug, created_by, is_personal)
    VALUES (
      u.name || '''s Workspace',
      'personal-' || u.user_id::text,
      u.user_id,
      true
    )
    ON CONFLICT (slug) DO NOTHING
    RETURNING id INTO ws_id;

    -- If workspace already existed, fetch its id
    IF ws_id IS NULL THEN
      SELECT id INTO ws_id FROM public.workspaces WHERE slug = 'personal-' || u.user_id::text;
    END IF;

    -- Add user as owner
    INSERT INTO public.workspace_members (workspace_id, user_id, role)
    VALUES (ws_id, u.user_id, 'owner')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;

    -- Backfill workspace_id on all user's data
    UPDATE public.work_entries SET workspace_id = ws_id WHERE user_id = u.user_id AND workspace_id IS NULL;
    UPDATE public.tasks SET workspace_id = ws_id WHERE user_id = u.user_id AND workspace_id IS NULL;
    UPDATE public.reminders SET workspace_id = ws_id WHERE user_id = u.user_id AND workspace_id IS NULL;
    UPDATE public.timer_sessions SET workspace_id = ws_id WHERE user_id = u.user_id AND workspace_id IS NULL;
    UPDATE public.daily_motivations SET workspace_id = ws_id WHERE user_id = u.user_id AND workspace_id IS NULL;
    UPDATE public.habits SET workspace_id = ws_id WHERE user_id = u.user_id AND workspace_id IS NULL;
    UPDATE public.goals SET workspace_id = ws_id WHERE user_id = u.user_id AND workspace_id IS NULL;
    UPDATE public.tags SET workspace_id = ws_id WHERE workspace_id IS NULL;
  END LOOP;
END $$;

-- =============================================================================
-- 7. RLS for new tables
-- =============================================================================
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Workspaces: members can view, owners/admins can update
DROP POLICY IF EXISTS "Members can view workspaces" ON public.workspaces;
CREATE POLICY "Members can view workspaces"
  ON public.workspaces FOR SELECT
  USING (public.user_has_workspace_access(id, 'viewer'));

DROP POLICY IF EXISTS "Authenticated users can create workspaces" ON public.workspaces;
CREATE POLICY "Authenticated users can create workspaces"
  ON public.workspaces FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "Admins can update workspaces" ON public.workspaces;
CREATE POLICY "Admins can update workspaces"
  ON public.workspaces FOR UPDATE
  USING (public.user_has_workspace_access(id, 'admin'));

DROP POLICY IF EXISTS "Owners can delete workspaces" ON public.workspaces;
CREATE POLICY "Owners can delete workspaces"
  ON public.workspaces FOR DELETE
  USING (public.user_has_workspace_access(id, 'owner'));

-- Workspace members: visible to workspace members, managed by admins
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
CREATE POLICY "Members can view workspace members"
  ON public.workspace_members FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));

DROP POLICY IF EXISTS "Admins can manage workspace members" ON public.workspace_members;
CREATE POLICY "Admins can manage workspace members"
  ON public.workspace_members FOR ALL
  USING (public.user_has_workspace_access(workspace_id, 'admin'))
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'admin'));

-- Workspace invitations: visible to admins, creatable by admins
DROP POLICY IF EXISTS "Admins can manage invitations" ON public.workspace_invitations;
CREATE POLICY "Admins can manage invitations"
  ON public.workspace_invitations FOR ALL
  USING (public.user_has_workspace_access(workspace_id, 'admin'))
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'admin'));

-- Public access to invitations by token (for accepting)
DROP POLICY IF EXISTS "Anyone can read invitations by token" ON public.workspace_invitations;
CREATE POLICY "Anyone can read invitations by token"
  ON public.workspace_invitations FOR SELECT
  TO authenticated
  USING (true);

-- =============================================================================
-- 8. Replace RLS policies on existing tables with workspace-scoped ones
-- =============================================================================

-- work_entries
DROP POLICY IF EXISTS "Users can CRUD own work_entries" ON public.work_entries;
DROP POLICY IF EXISTS "Workspace members can view work_entries" ON public.work_entries;
DROP POLICY IF EXISTS "Workspace editors can insert work_entries" ON public.work_entries;
DROP POLICY IF EXISTS "Workspace editors can update work_entries" ON public.work_entries;
DROP POLICY IF EXISTS "Workspace admins can delete work_entries" ON public.work_entries;

CREATE POLICY "Workspace members can view work_entries"
  ON public.work_entries FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));
CREATE POLICY "Workspace editors can insert work_entries"
  ON public.work_entries FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));
CREATE POLICY "Workspace editors can update work_entries"
  ON public.work_entries FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id, 'editor'));
CREATE POLICY "Workspace admins can delete work_entries"
  ON public.work_entries FOR DELETE
  USING (public.user_has_workspace_access(workspace_id, 'admin'));

-- tasks
DROP POLICY IF EXISTS "Users can CRUD own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Workspace members can view tasks" ON public.tasks;
DROP POLICY IF EXISTS "Workspace editors can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Workspace editors can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Workspace admins can delete tasks" ON public.tasks;

CREATE POLICY "Workspace members can view tasks"
  ON public.tasks FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));
CREATE POLICY "Workspace editors can insert tasks"
  ON public.tasks FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));
CREATE POLICY "Workspace editors can update tasks"
  ON public.tasks FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id, 'editor'));
CREATE POLICY "Workspace admins can delete tasks"
  ON public.tasks FOR DELETE
  USING (public.user_has_workspace_access(workspace_id, 'admin'));

-- reminders
DROP POLICY IF EXISTS "Users can CRUD own reminders" ON public.reminders;
DROP POLICY IF EXISTS "Workspace members can view reminders" ON public.reminders;
DROP POLICY IF EXISTS "Workspace editors can manage reminders" ON public.reminders;

CREATE POLICY "Workspace members can view reminders"
  ON public.reminders FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));
CREATE POLICY "Workspace editors can manage reminders"
  ON public.reminders FOR ALL
  USING (public.user_has_workspace_access(workspace_id, 'editor'))
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

-- timer_sessions
DROP POLICY IF EXISTS "Users can CRUD own timer_sessions" ON public.timer_sessions;
DROP POLICY IF EXISTS "Workspace members can view timer_sessions" ON public.timer_sessions;
DROP POLICY IF EXISTS "Workspace editors can manage timer_sessions" ON public.timer_sessions;

CREATE POLICY "Workspace members can view timer_sessions"
  ON public.timer_sessions FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));
CREATE POLICY "Workspace editors can manage timer_sessions"
  ON public.timer_sessions FOR ALL
  USING (public.user_has_workspace_access(workspace_id, 'editor'))
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

-- daily_motivations
DROP POLICY IF EXISTS "Users can CRUD own daily_motivations" ON public.daily_motivations;
DROP POLICY IF EXISTS "Workspace members can view daily_motivations" ON public.daily_motivations;
DROP POLICY IF EXISTS "Workspace editors can manage daily_motivations" ON public.daily_motivations;

CREATE POLICY "Workspace members can view daily_motivations"
  ON public.daily_motivations FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));
CREATE POLICY "Workspace editors can manage daily_motivations"
  ON public.daily_motivations FOR ALL
  USING (public.user_has_workspace_access(workspace_id, 'editor'))
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

-- habits
DROP POLICY IF EXISTS "Users can CRUD own habits" ON public.habits;
DROP POLICY IF EXISTS "Workspace members can view habits" ON public.habits;
DROP POLICY IF EXISTS "Workspace editors can manage habits" ON public.habits;

CREATE POLICY "Workspace members can view habits"
  ON public.habits FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));
CREATE POLICY "Workspace editors can manage habits"
  ON public.habits FOR ALL
  USING (public.user_has_workspace_access(workspace_id, 'editor'))
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

-- goals
DROP POLICY IF EXISTS "Users can CRUD own goals" ON public.goals;
DROP POLICY IF EXISTS "Workspace members can view goals" ON public.goals;
DROP POLICY IF EXISTS "Workspace editors can manage goals" ON public.goals;

CREATE POLICY "Workspace members can view goals"
  ON public.goals FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));
CREATE POLICY "Workspace editors can manage goals"
  ON public.goals FOR ALL
  USING (public.user_has_workspace_access(workspace_id, 'editor'))
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

-- goal_milestones (access through parent goal's workspace)
DROP POLICY IF EXISTS "Users can manage goal_milestones for own goals" ON public.goal_milestones;
DROP POLICY IF EXISTS "Workspace members can view goal_milestones" ON public.goal_milestones;
DROP POLICY IF EXISTS "Workspace editors can manage goal_milestones" ON public.goal_milestones;

CREATE POLICY "Workspace members can view goal_milestones"
  ON public.goal_milestones FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = goal_milestones.goal_id
      AND public.user_has_workspace_access(g.workspace_id, 'viewer')
    )
  );
CREATE POLICY "Workspace editors can manage goal_milestones"
  ON public.goal_milestones FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = goal_milestones.goal_id
      AND public.user_has_workspace_access(g.workspace_id, 'editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.goals g
      WHERE g.id = goal_milestones.goal_id
      AND public.user_has_workspace_access(g.workspace_id, 'editor')
    )
  );

-- habit_logs (access through parent habit's workspace)
DROP POLICY IF EXISTS "Users can manage habit_logs for own habits" ON public.habit_logs;
DROP POLICY IF EXISTS "Workspace members can view habit_logs" ON public.habit_logs;
DROP POLICY IF EXISTS "Workspace editors can manage habit_logs" ON public.habit_logs;

CREATE POLICY "Workspace members can view habit_logs"
  ON public.habit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.habits h
      WHERE h.id = habit_logs.habit_id
      AND public.user_has_workspace_access(h.workspace_id, 'viewer')
    )
  );
CREATE POLICY "Workspace editors can manage habit_logs"
  ON public.habit_logs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.habits h
      WHERE h.id = habit_logs.habit_id
      AND public.user_has_workspace_access(h.workspace_id, 'editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.habits h
      WHERE h.id = habit_logs.habit_id
      AND public.user_has_workspace_access(h.workspace_id, 'editor')
    )
  );

-- tags: workspace-scoped
DROP POLICY IF EXISTS "Authenticated users can read tags" ON public.tags;
DROP POLICY IF EXISTS "Authenticated users can insert tags" ON public.tags;
DROP POLICY IF EXISTS "Authenticated users can update tags" ON public.tags;
DROP POLICY IF EXISTS "Workspace members can view tags" ON public.tags;
DROP POLICY IF EXISTS "Workspace editors can manage tags" ON public.tags;

CREATE POLICY "Workspace members can view tags"
  ON public.tags FOR SELECT
  USING (workspace_id IS NULL OR public.user_has_workspace_access(workspace_id, 'viewer'));
CREATE POLICY "Workspace editors can manage tags"
  ON public.tags FOR ALL
  USING (workspace_id IS NULL OR public.user_has_workspace_access(workspace_id, 'editor'))
  WITH CHECK (workspace_id IS NULL OR public.user_has_workspace_access(workspace_id, 'editor'));

-- entry_tags: access through parent entry's workspace
DROP POLICY IF EXISTS "Users can manage entry_tags for own entries" ON public.entry_tags;
DROP POLICY IF EXISTS "Workspace members can view entry_tags" ON public.entry_tags;
DROP POLICY IF EXISTS "Workspace editors can manage entry_tags" ON public.entry_tags;

CREATE POLICY "Workspace members can view entry_tags"
  ON public.entry_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.work_entries e
      WHERE e.id = entry_tags.entry_id
      AND public.user_has_workspace_access(e.workspace_id, 'viewer')
    )
  );
CREATE POLICY "Workspace editors can manage entry_tags"
  ON public.entry_tags FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.work_entries e
      WHERE e.id = entry_tags.entry_id
      AND public.user_has_workspace_access(e.workspace_id, 'editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.work_entries e
      WHERE e.id = entry_tags.entry_id
      AND public.user_has_workspace_access(e.workspace_id, 'editor')
    )
  );

-- attachments: access through parent entry's workspace
DROP POLICY IF EXISTS "Users can manage attachments for own entries" ON public.attachments;
DROP POLICY IF EXISTS "Workspace members can view attachments" ON public.attachments;
DROP POLICY IF EXISTS "Workspace editors can manage attachments" ON public.attachments;

CREATE POLICY "Workspace members can view attachments"
  ON public.attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.work_entries e
      WHERE e.id = attachments.entry_id
      AND public.user_has_workspace_access(e.workspace_id, 'viewer')
    )
  );
CREATE POLICY "Workspace editors can manage attachments"
  ON public.attachments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.work_entries e
      WHERE e.id = attachments.entry_id
      AND public.user_has_workspace_access(e.workspace_id, 'editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.work_entries e
      WHERE e.id = attachments.entry_id
      AND public.user_has_workspace_access(e.workspace_id, 'editor')
    )
  );

-- =============================================================================
-- 9. Triggers for updated_at
-- =============================================================================
DROP TRIGGER IF EXISTS update_workspaces_updated_at ON public.workspaces;
CREATE TRIGGER update_workspaces_updated_at
  BEFORE UPDATE ON public.workspaces
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();
