-- Migration already applied to live project Club42-Quiz as 20261013234600_soundboard_shared_custom_favorites.
-- Persistence for custom Myinstants sounds and favorites. Only token-verified
-- Master RPCs may read or modify this private, RLS-enabled table.

CREATE TABLE private.soundboard_items (
  slug text PRIMARY KEY CHECK (slug ~ '^[a-z0-9][a-z0-9_-]{0,149}$'),
  title text,
  is_custom boolean NOT NULL DEFAULT false,
  is_favorite boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT soundboard_item_nonempty CHECK (is_custom OR is_favorite),
  CONSTRAINT soundboard_custom_title CHECK (
    NOT is_custom OR (title IS NOT NULL AND length(btrim(title)) BETWEEN 1 AND 90)
  )
);
ALTER TABLE private.soundboard_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON private.soundboard_items FROM PUBLIC, anon, authenticated;

CREATE FUNCTION private.master_soundboard_get(p_session_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE v_custom jsonb; v_favorites jsonb;
BEGIN
  IF NOT private.is_master_session(p_session_token) THEN
    RAISE EXCEPTION 'MASTER_NON_AUTORIZZATO' USING errcode='28000';
  END IF;
  SELECT
    COALESCE(jsonb_agg(jsonb_build_object('slug',slug,'title',title)
      ORDER BY updated_at,slug) FILTER (WHERE is_custom), '[]'::jsonb),
    COALESCE(jsonb_agg(to_jsonb(slug) ORDER BY updated_at,slug)
      FILTER (WHERE is_favorite), '[]'::jsonb)
  INTO v_custom,v_favorites FROM private.soundboard_items;
  RETURN jsonb_build_object('custom',v_custom,'favorites',v_favorites);
END;
$$;

CREATE FUNCTION private.master_soundboard_change(
  p_session_token text, p_operation text, p_slug text,
  p_title text DEFAULT NULL, p_favorite boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
BEGIN
  IF NOT private.is_master_session(p_session_token) THEN
    RAISE EXCEPTION 'MASTER_NON_AUTORIZZATO' USING errcode='28000';
  END IF;
  IF p_slug IS NULL OR p_slug !~ '^[a-z0-9][a-z0-9_-]{0,149}$' THEN
    RAISE EXCEPTION 'SUONO_NON_VALIDO' USING errcode='22023';
  END IF;

  IF p_operation = 'add' THEN
    IF p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 90 THEN
      RAISE EXCEPTION 'TITOLO_SUONO_NON_VALIDO' USING errcode='22023';
    END IF;
    INSERT INTO private.soundboard_items(slug,title,is_custom,is_favorite)
    VALUES (p_slug,btrim(p_title),true,false)
    ON CONFLICT (slug) DO UPDATE
    SET title=EXCLUDED.title,is_custom=true,updated_at=clock_timestamp();

  ELSIF p_operation = 'remove' THEN
    DELETE FROM private.soundboard_items WHERE slug=p_slug AND is_custom=true;

  ELSIF p_operation = 'favorite' THEN
    IF p_favorite IS NULL THEN
      RAISE EXCEPTION 'PREFERITO_NON_VALIDO' USING errcode='22023';
    END IF;
    IF p_favorite THEN
      INSERT INTO private.soundboard_items(slug,title,is_custom,is_favorite)
      VALUES (p_slug,NULL,false,true)
      ON CONFLICT(slug) DO UPDATE SET is_favorite=true,updated_at=clock_timestamp();
    ELSE
      UPDATE private.soundboard_items
      SET is_favorite=false,updated_at=clock_timestamp()
      WHERE slug=p_slug AND is_custom=true;
      DELETE FROM private.soundboard_items WHERE slug=p_slug AND is_custom=false;
    END IF;
  ELSE
    RAISE EXCEPTION 'OPERAZIONE_SUONO_NON_VALIDA' USING errcode='22023';
  END IF;
END;
$$;

CREATE FUNCTION private.master_soundboard_import(
  p_session_token text, p_custom jsonb, p_favorites jsonb
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $$
DECLARE item jsonb; v_slug text; v_title text;
BEGIN
  IF NOT private.is_master_session(p_session_token) THEN
    RAISE EXCEPTION 'MASTER_NON_AUTORIZZATO' USING errcode='28000';
  END IF;
  IF p_custom IS NULL OR jsonb_typeof(p_custom) <> 'array'
     OR jsonb_array_length(p_custom) > 500
     OR p_favorites IS NULL OR jsonb_typeof(p_favorites) <> 'array'
     OR jsonb_array_length(p_favorites) > 500 THEN
    RAISE EXCEPTION 'IMPORTAZIONE_SUONI_NON_VALIDA' USING errcode='22023';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(p_custom) AS elements(value)
  LOOP
    IF jsonb_typeof(item) <> 'object' THEN
      RAISE EXCEPTION 'SUONO_NON_VALIDO' USING errcode='22023';
    END IF;
    v_slug := item->>'slug';
    v_title := item->>'title';
    IF v_slug IS NULL OR v_slug !~ '^[a-z0-9][a-z0-9_-]{0,149}$'
       OR v_title IS NULL OR length(btrim(v_title)) NOT BETWEEN 1 AND 90 THEN
      RAISE EXCEPTION 'SUONO_NON_VALIDO' USING errcode='22023';
    END IF;
    INSERT INTO private.soundboard_items(slug,title,is_custom,is_favorite)
    VALUES(v_slug,btrim(v_title),true,false)
    ON CONFLICT(slug) DO UPDATE
    SET is_custom=true,title=EXCLUDED.title,updated_at=clock_timestamp();
  END LOOP;

  FOR item IN SELECT value FROM jsonb_array_elements(p_favorites) AS elements(value)
  LOOP
    IF jsonb_typeof(item) <> 'string' THEN
      RAISE EXCEPTION 'PREFERITO_NON_VALIDO' USING errcode='22023';
    END IF;
    v_slug := item #>> '{}';
    IF v_slug !~ '^[a-z0-9][a-z0-9_-]{0,149}$' THEN
      RAISE EXCEPTION 'PREFERITO_NON_VALIDO' USING errcode='22023';
    END IF;
    INSERT INTO private.soundboard_items(slug,title,is_custom,is_favorite)
    VALUES(v_slug,NULL,false,true)
    ON CONFLICT(slug) DO UPDATE
    SET is_favorite=true,updated_at=clock_timestamp();
  END LOOP;
END;
$$;

CREATE FUNCTION public.master_soundboard_get(p_session_token text)
RETURNS jsonb LANGUAGE sql SET search_path TO ''
AS $$ SELECT private.master_soundboard_get(p_session_token) $$;

CREATE FUNCTION public.master_soundboard_change(
  p_session_token text,p_operation text,p_slug text,
  p_title text DEFAULT NULL,p_favorite boolean DEFAULT NULL)
RETURNS void LANGUAGE sql SET search_path TO ''
AS $$ SELECT private.master_soundboard_change(p_session_token,p_operation,p_slug,p_title,p_favorite) $$;

CREATE FUNCTION public.master_soundboard_import(
  p_session_token text,p_custom jsonb,p_favorites jsonb)
RETURNS void LANGUAGE sql SET search_path TO ''
AS $$ SELECT private.master_soundboard_import(p_session_token,p_custom,p_favorites) $$;

REVOKE ALL ON FUNCTION private.master_soundboard_get(text),
 private.master_soundboard_change(text,text,text,text,boolean),
 private.master_soundboard_import(text,jsonb,jsonb),
 public.master_soundboard_get(text),
 public.master_soundboard_change(text,text,text,text,boolean),
 public.master_soundboard_import(text,jsonb,jsonb) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION private.master_soundboard_get(text),
 private.master_soundboard_change(text,text,text,text,boolean),
 private.master_soundboard_import(text,jsonb,jsonb),
 public.master_soundboard_get(text),
 public.master_soundboard_change(text,text,text,text,boolean),
 public.master_soundboard_import(text,jsonb,jsonb) TO anon,authenticated;
