-- Whitelist requests (public form for people to request access)
CREATE TABLE IF NOT EXISTS public.whitelist_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whitelist_requests_status
  ON public.whitelist_requests(status);

-- Allow anonymous inserts (public form) but only admin reads
ALTER TABLE public.whitelist_requests ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a request (no auth needed)
DROP POLICY IF EXISTS "Anyone can submit whitelist request" ON public.whitelist_requests;
CREATE POLICY "Anyone can submit whitelist request"
  ON public.whitelist_requests FOR INSERT
  WITH CHECK (true);

-- Only service_role can read (admin API uses service role)
-- No SELECT policy for anon/authenticated = only admin client can read

-- Feedback from users
CREATE TABLE IF NOT EXISTS public.user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  email TEXT,
  name TEXT,
  type TEXT NOT NULL DEFAULT 'general' CHECK (type IN ('bug', 'feature', 'general', 'complaint')),
  message TEXT NOT NULL,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'reviewed', 'resolved')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_status
  ON public.user_feedback(status);

ALTER TABLE public.user_feedback ENABLE ROW LEVEL SECURITY;

-- Authenticated users can submit feedback
DROP POLICY IF EXISTS "Users can submit feedback" ON public.user_feedback;
CREATE POLICY "Users can submit feedback"
  ON public.user_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own feedback
DROP POLICY IF EXISTS "Users can view own feedback" ON public.user_feedback;
CREATE POLICY "Users can view own feedback"
  ON public.user_feedback FOR SELECT
  USING (auth.uid() = user_id);
