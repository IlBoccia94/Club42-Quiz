-- Applied in Supabase: 20261028120802_soundboard_private_uploaded_audio
CREATE TABLE IF NOT EXISTS public.soundboard_uploaded_audio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (length(btrim(title)) BETWEEN 1 AND 90),
  storage_path text NOT NULL UNIQUE CHECK (storage_path ~ '^[a-f0-9-]{36}\.(mp3|wav|ogg|m4a|aac|webm|flac)$'),
  mime_type text NOT NULL CHECK (mime_type IN ('audio/mpeg','audio/wav','audio/ogg','audio/mp4','audio/aac','audio/webm','audio/flac')),
  size_bytes integer NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.soundboard_uploaded_audio ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.soundboard_uploaded_audio FROM PUBLIC, anon, authenticated;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('club42-quiz-audio','club42-quiz-audio',false,10485760,
ARRAY['audio/mpeg','audio/wav','audio/ogg','audio/mp4','audio/aac','audio/webm','audio/flac']::text[])
ON CONFLICT(id) DO UPDATE SET
  public=false, file_size_limit=EXCLUDED.file_size_limit,
  allowed_mime_types=EXCLUDED.allowed_mime_types;
