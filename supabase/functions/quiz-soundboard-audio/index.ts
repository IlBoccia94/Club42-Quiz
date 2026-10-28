import { createClient } from "npm:@supabase/supabase-js@2.117.1";

const BUCKET = "club42-quiz-audio";
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FILES = 200;
const ALLOWED_ORIGINS = new Set([
  "https://ilboccia94.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
const CONTENT_TYPES: Record<string, { mime: string; extension: string }> = {
  "audio/mpeg": { mime: "audio/mpeg", extension: "mp3" },
  "audio/mp3": { mime: "audio/mpeg", extension: "mp3" },
  "audio/wav": { mime: "audio/wav", extension: "wav" },
  "audio/x-wav": { mime: "audio/wav", extension: "wav" },
  "audio/wave": { mime: "audio/wav", extension: "wav" },
  "audio/ogg": { mime: "audio/ogg", extension: "ogg" },
  "application/ogg": { mime: "audio/ogg", extension: "ogg" },
  "audio/mp4": { mime: "audio/mp4", extension: "m4a" },
  "audio/x-m4a": { mime: "audio/mp4", extension: "m4a" },
  "audio/aac": { mime: "audio/aac", extension: "aac" },
  "audio/x-aac": { mime: "audio/aac", extension: "aac" },
  "audio/webm": { mime: "audio/webm", extension: "webm" },
  "audio/flac": { mime: "audio/flac", extension: "flac" },
  "audio/x-flac": { mime: "audio/flac", extension: "flac" },
};
const MIME_BY_EXTENSION: Record<string, string> = {
  mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg",
  m4a: "audio/mp4", aac: "audio/aac", webm: "audio/webm",
  flac: "audio/flac",
};

function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://ilboccia94.github.io",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}
function response(req: Request, status: number, value: Record<string, unknown>) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store" },
  });
}
function isAudio(bytes: Uint8Array, mime: string) {
  if (bytes.length < 12) return false;
  const text = (start: number, length: number) =>
    String.fromCharCode(...bytes.subarray(start, start + length));
  switch (mime) {
    case "audio/mpeg":
      return text(0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
    case "audio/wav":
      return text(0, 4) === "RIFF" && text(8, 4) === "WAVE";
    case "audio/ogg":
      return text(0, 4) === "OggS";
    case "audio/mp4":
      return text(4, 4) === "ftyp";
    case "audio/webm":
      return bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3;
    case "audio/flac":
      return text(0, 4) === "fLaC";
    case "audio/aac":
      return bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0;
    default:
      return false;
  }
}

const service = createClient(
  Deno.env.get("SUPABASE_URL") || "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
  { auth: { autoRefreshToken: false, persistSession: false } }
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return response(req, 405, { error: "Metodo non consentito." });

  try {
    const multipart = (req.headers.get("content-type") || "").includes("multipart/form-data");
    const params = multipart ? await req.formData() : await req.json();
    const value = (key: string): unknown => multipart
      ? (params as FormData).get(key)
      : (params as Record<string, unknown>)[key];
    const token = value("session_token");
    const action = value("action");
    if (typeof token !== "string" || !token || token.length > 512) {
      return response(req, 401, { error: "Sessione Master non valida." });
    }

    // Existing hardened RPC reads a private table and checks the Master session token.
    // Never use the service-role key in the browser, and never trust a caller-provided path.
    const { error: authError } = await service.rpc("master_soundboard_get", {
      p_session_token: token,
    });
    if (authError) {
      return response(req, 401, { error: "Sessione Master scaduta. Effettua nuovamente l'accesso." });
    }

    if (action === "list") {
      const { data, error } = await service.from("soundboard_uploaded_audio")
        .select("id,title,storage_path,mime_type,size_bytes,created_at")
        .order("created_at", { ascending: false }).limit(MAX_FILES);
      if (error) throw error;
      const items = data || [];
      if (!items.length) return response(req, 200, { items: [] });
      const { data: signed, error: signError } = await service.storage.from(BUCKET)
        .createSignedUrls(items.map((item) => item.storage_path), 3600);
      if (signError) throw signError;
      const result = items.map((item, index) => ({
        id: item.id,
        title: item.title,
        size_bytes: item.size_bytes,
        created_at: item.created_at,
        signed_url: signed?.[index]?.signedUrl || null,
      }));
      return response(req, 200, { items: result });
    }

    if (action === "upload") {
      if (!multipart) return response(req, 400, { error: "Seleziona un file audio." });
      const file = value("file");
      if (!(file instanceof File) || file.size <= 0 || file.size > MAX_BYTES) {
        return response(req, 400, { error: "Il file deve avere una dimensione massima di 10 MB." });
      }
      const extension = file.name.toLowerCase().split(".").pop() || "";
      const declared = CONTENT_TYPES[file.type.toLowerCase()]?.mime;
      const mime = declared || MIME_BY_EXTENSION[extension];
      if (!mime || !MIME_BY_EXTENSION[extension] ||
          MIME_BY_EXTENSION[extension] !== mime) {
        return response(req, 400, { error: "Formato non supportato: usa MP3, WAV, OGG, M4A, AAC, WebM o FLAC." });
      }
      const titleInput = value("title");
      const title = typeof titleInput === "string" && titleInput.trim()
        ? titleInput.trim() : file.name.replace(/\.[^.]+$/, "").trim();
      if (!title || title.length > 90) {
        return response(req, 400, { error: "Il nome deve contenere da 1 a 90 caratteri." });
      }
      const { count, error: countError } = await service.from("soundboard_uploaded_audio")
        .select("id", { count: "exact", head: true });
      if (countError) throw countError;
      if ((count || 0) >= MAX_FILES) {
        return response(req, 400, { error: "Limite di 200 file audio personalizzati raggiunto." });
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!isAudio(bytes, mime)) {
        return response(req, 400, { error: "Il contenuto non sembra un file audio valido." });
      }
      const id = crypto.randomUUID();
      const path = id + "." + CONTENT_TYPES[mime].extension;
      const { error: uploadError } = await service.storage.from(BUCKET).upload(
        path, bytes, { contentType: mime, upsert: false, cacheControl: "3600" }
      );
      if (uploadError) throw uploadError;
      const { error: insertError } = await service.from("soundboard_uploaded_audio").insert({
        id, title, storage_path: path, mime_type: mime, size_bytes: file.size,
      });
      if (insertError) {
        await service.storage.from(BUCKET).remove([path]);
        throw insertError;
      }
      return response(req, 200, { id, title });
    }

    if (action === "delete") {
      const id = value("id");
      if (typeof id !== "string" || !/^[a-f0-9-]{36}$/.test(id)) {
        return response(req, 400, { error: "Pulsante non valido." });
      }
      const { data: item, error: findError } = await service
        .from("soundboard_uploaded_audio").select("id,storage_path").eq("id", id).maybeSingle();
      if (findError) throw findError;
      if (!item) return response(req, 200, { deleted: true });
      const { error: deleteObjectError } = await service.storage.from(BUCKET).remove([item.storage_path]);
      if (deleteObjectError) throw deleteObjectError;
      const { error: deleteRecordError } = await service.from("soundboard_uploaded_audio")
        .delete().eq("id", id);
      if (deleteRecordError) throw deleteRecordError;
      return response(req, 200, { deleted: true });
    }

    return response(req, 400, { error: "Operazione non riconosciuta." });
  } catch (error) {
    console.error("Audio soundboard:", error instanceof Error ? error.message : String(error));
    return response(req, 500, { error: "Operazione non riuscita. Riprova." });
  }
});
