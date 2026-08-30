ALTER TABLE public.feedback ADD COLUMN IF NOT EXISTS name text;
GRANT INSERT ON public.feedback TO anon;
GRANT INSERT ON public.feedback TO authenticated;
GRANT ALL ON public.feedback TO service_role;