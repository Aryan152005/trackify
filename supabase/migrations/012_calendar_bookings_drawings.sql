-- Calendar, Bookings & Drawings
-- Run after 011_notifications_requests.sql

-- =============================================================================
-- 1. calendar_events
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  color TEXT DEFAULT '#6366f1',
  recurrence_rule TEXT,
  location TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  related_entity_type TEXT,
  related_entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_workspace
  ON public.calendar_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_start_time
  ON public.calendar_events(start_time);

-- RLS
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace viewers can view calendar events" ON public.calendar_events;
CREATE POLICY "Workspace viewers can view calendar events"
  ON public.calendar_events FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));

DROP POLICY IF EXISTS "Workspace editors can create calendar events" ON public.calendar_events;
CREATE POLICY "Workspace editors can create calendar events"
  ON public.calendar_events FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

DROP POLICY IF EXISTS "Workspace editors can update calendar events" ON public.calendar_events;
CREATE POLICY "Workspace editors can update calendar events"
  ON public.calendar_events FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id, 'editor'))
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

DROP POLICY IF EXISTS "Workspace admins can delete calendar events" ON public.calendar_events;
CREATE POLICY "Workspace admins can delete calendar events"
  ON public.calendar_events FOR DELETE
  USING (public.user_has_workspace_access(workspace_id, 'admin'));

-- updated_at trigger
DROP TRIGGER IF EXISTS update_calendar_events_updated_at ON public.calendar_events;
CREATE TRIGGER update_calendar_events_updated_at
  BEFORE UPDATE ON public.calendar_events
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();

-- =============================================================================
-- 2. calendar_event_attendees
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.calendar_event_attendees (
  event_id UUID NOT NULL REFERENCES public.calendar_events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'tentative')),
  PRIMARY KEY (event_id, user_id)
);

-- RLS (access through parent event workspace)
ALTER TABLE public.calendar_event_attendees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Attendees viewable by workspace members" ON public.calendar_event_attendees;
CREATE POLICY "Attendees viewable by workspace members"
  ON public.calendar_event_attendees FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.calendar_events ce
      WHERE ce.id = event_id
      AND public.user_has_workspace_access(ce.workspace_id, 'viewer')
    )
  );

DROP POLICY IF EXISTS "Workspace editors can manage attendees" ON public.calendar_event_attendees;
CREATE POLICY "Workspace editors can manage attendees"
  ON public.calendar_event_attendees FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.calendar_events ce
      WHERE ce.id = event_id
      AND public.user_has_workspace_access(ce.workspace_id, 'editor')
    )
  );

DROP POLICY IF EXISTS "Workspace editors can update attendees" ON public.calendar_event_attendees;
CREATE POLICY "Workspace editors can update attendees"
  ON public.calendar_event_attendees FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.calendar_events ce
      WHERE ce.id = event_id
      AND public.user_has_workspace_access(ce.workspace_id, 'editor')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.calendar_events ce
      WHERE ce.id = event_id
      AND public.user_has_workspace_access(ce.workspace_id, 'editor')
    )
  );

DROP POLICY IF EXISTS "Workspace editors can delete attendees" ON public.calendar_event_attendees;
CREATE POLICY "Workspace editors can delete attendees"
  ON public.calendar_event_attendees FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.calendar_events ce
      WHERE ce.id = event_id
      AND public.user_has_workspace_access(ce.workspace_id, 'editor')
    )
  );

-- =============================================================================
-- 3. bookable_resources
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bookable_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('room', 'equipment', 'person', 'slot')),
  availability JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.bookable_resources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace viewers can view resources" ON public.bookable_resources;
CREATE POLICY "Workspace viewers can view resources"
  ON public.bookable_resources FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));

DROP POLICY IF EXISTS "Workspace admins can create resources" ON public.bookable_resources;
CREATE POLICY "Workspace admins can create resources"
  ON public.bookable_resources FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'admin'));

DROP POLICY IF EXISTS "Workspace admins can update resources" ON public.bookable_resources;
CREATE POLICY "Workspace admins can update resources"
  ON public.bookable_resources FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id, 'admin'))
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'admin'));

DROP POLICY IF EXISTS "Workspace admins can delete resources" ON public.bookable_resources;
CREATE POLICY "Workspace admins can delete resources"
  ON public.bookable_resources FOR DELETE
  USING (public.user_has_workspace_access(workspace_id, 'admin'));

-- =============================================================================
-- 4. bookings
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL REFERENCES public.bookable_resources(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  booked_by UUID NOT NULL REFERENCES auth.users(id),
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'pending')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace viewers can view bookings" ON public.bookings;
CREATE POLICY "Workspace viewers can view bookings"
  ON public.bookings FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));

DROP POLICY IF EXISTS "Workspace editors can create bookings" ON public.bookings;
CREATE POLICY "Workspace editors can create bookings"
  ON public.bookings FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

DROP POLICY IF EXISTS "Workspace editors can update bookings" ON public.bookings;
CREATE POLICY "Workspace editors can update bookings"
  ON public.bookings FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id, 'editor'))
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

DROP POLICY IF EXISTS "Workspace admins can delete bookings" ON public.bookings;
CREATE POLICY "Workspace admins can delete bookings"
  ON public.bookings FOR DELETE
  USING (public.user_has_workspace_access(workspace_id, 'admin'));

-- =============================================================================
-- 5. drawings
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.drawings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Drawing',
  data JSONB NOT NULL DEFAULT '{}',
  thumbnail_url TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.drawings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace viewers can view drawings" ON public.drawings;
CREATE POLICY "Workspace viewers can view drawings"
  ON public.drawings FOR SELECT
  USING (public.user_has_workspace_access(workspace_id, 'viewer'));

DROP POLICY IF EXISTS "Workspace editors can create drawings" ON public.drawings;
CREATE POLICY "Workspace editors can create drawings"
  ON public.drawings FOR INSERT
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

DROP POLICY IF EXISTS "Workspace editors can update drawings" ON public.drawings;
CREATE POLICY "Workspace editors can update drawings"
  ON public.drawings FOR UPDATE
  USING (public.user_has_workspace_access(workspace_id, 'editor'))
  WITH CHECK (public.user_has_workspace_access(workspace_id, 'editor'));

DROP POLICY IF EXISTS "Workspace admins can delete drawings" ON public.drawings;
CREATE POLICY "Workspace admins can delete drawings"
  ON public.drawings FOR DELETE
  USING (public.user_has_workspace_access(workspace_id, 'admin'));

-- updated_at trigger
DROP TRIGGER IF EXISTS update_drawings_updated_at ON public.drawings;
CREATE TRIGGER update_drawings_updated_at
  BEFORE UPDATE ON public.drawings
  FOR EACH ROW
  EXECUTE PROCEDURE update_updated_at_column();
