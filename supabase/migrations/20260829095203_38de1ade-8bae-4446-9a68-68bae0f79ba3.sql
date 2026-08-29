CREATE TABLE public.feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  kind TEXT NOT NULL DEFAULT 'feedback',
  message TEXT NOT NULL,
  rating SMALLINT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.feedback ADD CONSTRAINT feedback_kind_check CHECK (kind IN ('feedback','suggestion','feature','bug'));
ALTER TABLE public.feedback ADD CONSTRAINT feedback_rating_check CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));
ALTER TABLE public.feedback ADD CONSTRAINT feedback_message_check CHECK (char_length(message) BETWEEN 1 AND 2000);
ALTER TABLE public.feedback ADD CONSTRAINT feedback_email_check CHECK (email IS NULL OR char_length(email) <= 255);

GRANT INSERT ON public.feedback TO anon, authenticated;
GRANT ALL ON public.feedback TO service_role;

ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit feedback"
ON public.feedback FOR INSERT TO anon, authenticated
WITH CHECK (true);