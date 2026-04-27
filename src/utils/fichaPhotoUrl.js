/**
 * Orden de campos habituales en documentos "fichas-omc" para la URL de la foto.
 * Si en Firestore el campo no se llama exactamente `image`, el modal quedaba sin foto.
 */
const CANDIDATE_KEYS = [
  "image",
  "imagen",
  "foto",
  "fotoUrl",
  "urlFoto",
  "photo",
  "img",
  "url",
];

const NESTED_STRING_KEYS = [
  "url",
  "href",
  "downloadURL",
  "downloadUrl",
  "src",
  "link",
  "path",
  "fullPath",
  "uri",
];

/**
 * @param {unknown} value
 * @returns {string | undefined}
 */
function extractPhotoStringFromValue(value) {
  if (typeof value === "string") {
    const t = value.trim();
    return t.length > 0 ? t : undefined;
  }
  if (value != null && typeof value === "object" && !Array.isArray(value)) {
    const o = /** @type {Record<string, unknown>} */ (value);
    for (const nk of NESTED_STRING_KEYS) {
      const inner = o[nk];
      if (typeof inner === "string" && inner.trim().length > 0) {
        return inner.trim();
      }
    }
  }
  return undefined;
}

/**
 * Indica si un string parece una URL o ruta habitual de imagen (no un legajo o texto libre).
 * @param {string} t
 */
export function looksLikeClassicImageSource(t) {
  const s = t.trim();
  if (!s) return false;
  if (s.startsWith("gs://")) return true;
  if (/^data:image\//i.test(s)) return true;
  if (/^https?:\/\//i.test(s)) return true;
  if (s.startsWith("/")) return true;
  if (/^[a-zA-Z]:[\\/]/.test(s)) return true;
  if (s.includes("/") && !/\s/.test(s)) return true;
  if (/\.(jpe?g|png|gif|webp|svg|bmp|avif|heic|heif)(\?|#|$)/i.test(s))
    return true;
  return false;
}

/**
 * Serializa el valor completo para consola o UI (sin recorte salvo límite de seguridad).
 * @param {unknown} value
 * @param {number} [maxChars] límite máximo de caracteres (evita congelar el navegador con base64 enorme)
 * @returns {string}
 */
export function serializeValueFull(value, maxChars = 400000) {
  if (value === undefined) return "(undefined)";
  if (value === null) return "(null)";
  const tipo = typeof value;
  if (tipo === "string") {
    return capFullString(value, maxChars);
  }
  if (tipo === "number" || tipo === "boolean" || tipo === "bigint") {
    return String(value);
  }
  if (tipo === "function") {
    try {
      return capFullString(String(value), maxChars);
    } catch {
      return "(function)";
    }
  }
  if (value != null && tipo === "object") {
    const o = /** @type {{ toDate?: () => Date; seconds?: number; nanoseconds?: number }} */ (
      value
    );
    if (typeof o.toDate === "function") {
      try {
        return `Firestore Timestamp → ISO: ${o.toDate().toISOString()}`;
      } catch {
        /* continuar */
      }
    }
    if (typeof o.seconds === "number") {
      return JSON.stringify(
        {
          __tipoFirestore: "Timestamp",
          seconds: o.seconds,
          nanoseconds: typeof o.nanoseconds === "number" ? o.nanoseconds : 0,
        },
        null,
        2
      );
    }
    try {
      return capFullString(
        JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2),
        maxChars
      );
    } catch {
      return capFullString(String(value), maxChars);
    }
  }
  return capFullString(String(value), maxChars);
}

/**
 * @param {string} s
 * @param {number} maxChars
 */
function capFullString(s, maxChars) {
  if (s.length <= maxChars) return s;
  return `${s.slice(0, maxChars)}\n\n… [corte de seguridad: ${s.length} caracteres en total; mostrados ${maxChars}]`;
}

export function serializeValueForDisplay(value, max = 220) {
  if (value === undefined) return "(undefined)";
  if (value === null) return "(null)";
  const tipo = typeof value;
  if (tipo === "string") {
    return truncateForLog(value, max);
  }
  if (tipo === "number" || tipo === "boolean" || tipo === "bigint") {
    return String(value);
  }
  if (tipo === "function") {
    return `[function ${value.name || "anónima"}]`;
  }
  if (Array.isArray(value)) {
    const n = value.length;
    const first = value[0];
    return `[array length=${n}] primer elemento: ${serializeValueForDisplay(
      first,
      Math.min(80, max)
    )}`;
  }
  if (tipo === "object") {
    try {
      const c = /** @type {{ constructor?: { name?: string } }} */ (value);
      const name = c?.constructor?.name ?? "Object";
      const json = JSON.stringify(value);
      if (json == null) return `[${name}]`;
      return truncateForLog(`[${name}] ${json}`, max);
    } catch {
      return "[object no serializable a JSON]";
    }
  }
  return truncateForLog(String(value), max);
}

/**
 * Por cada campo candidato a foto, describe tipo y vista previa (aunque no sea string).
 * @param {Record<string, unknown>} record
 * @returns {Array<{ key: string; definido: boolean; tipoDato: string; constructor: string; vistaPrevia: string; pareceUrlClasica: boolean; valorCompleto: string; stringCrudo?: string }>}
 */
export function inspectPhotoCandidateKeys(record) {
  return CANDIDATE_KEYS.map((key) => {
    if (!Object.prototype.hasOwnProperty.call(record, key)) {
      return {
        key,
        definido: false,
        tipoDato: "(no definido)",
        constructor: "—",
        vistaPrevia: "—",
        pareceUrlClasica: false,
        valorCompleto: "—",
      };
    }
    const v = record[key];
    const tipoDato = v === null ? "null" : Array.isArray(v) ? "array" : typeof v;
    const constructor =
      v != null && typeof v === "object"
        ? /** @type {{ constructor?: { name?: string } }} */ (v).constructor?.name ??
          "Object"
        : "—";
    const vistaPrevia = serializeValueForDisplay(v, 200);
    const pareceUrlClasica =
      typeof v === "string" ? looksLikeClassicImageSource(v) : false;
    const valorCompleto = serializeValueFull(v);
    const stringCrudo = typeof v === "string" ? v : undefined;
    return {
      key,
      definido: true,
      tipoDato,
      constructor,
      vistaPrevia,
      pareceUrlClasica,
      valorCompleto,
      stringCrudo,
    };
  });
}

/**
 * @param {Record<string, unknown>} record
 * @returns {{ key?: string; raw?: string; fromNested?: boolean }}
 */
export function pickRawPhotoUrlMeta(record) {
  for (const key of CANDIDATE_KEYS) {
    const v = record[key];
    const direct = extractPhotoStringFromValue(v);
    if (direct) {
      const fromNested =
        typeof v === "object" && v !== null && !Array.isArray(v);
      return { key, raw: direct, fromNested };
    }
  }
  return {};
}

/**
 * @param {Record<string, unknown>} record
 * @returns {string | undefined}
 */
export function pickRawPhotoUrl(record) {
  const { raw } = pickRawPhotoUrlMeta(record);
  return raw;
}

/**
 * Recorta strings largas (p. ej. URLs firmadas) para consola.
 * @param {unknown} value
 * @param {number} [max]
 * @returns {string}
 */
export function truncateForLog(value, max = 120) {
  if (value == null) return "";
  const s = String(value);
  if (s.length <= max) return s;
  return `${s.slice(0, max)}… (${s.length} caracteres en total)`;
}

/**
 * @param {string} raw
 * @returns
 *   | { kind: "none" }
 *   | { kind: "gs"; gsUrl: string }
 *   | { kind: "http"; url: string }
 *   | { kind: "opaqueString"; raw: string }
 */
export function classifyPhotoUrl(raw) {
  const t = raw.trim();
  if (!t) return { kind: "none" };
  if (t.startsWith("gs://")) return { kind: "gs", gsUrl: t };
  if (/^data:image\//i.test(t)) return { kind: "http", url: t };
  if (/^https?:\/\//i.test(t)) {
    try {
      const u = new URL(t);
      if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
        if (typeof window !== "undefined" && window.location) {
          return {
            kind: "http",
            url: `${window.location.origin}${u.pathname}${u.search}`,
          };
        }
      }
    } catch {
      /* URL inválida: se devuelve tal cual */
    }
    return { kind: "http", url: t };
  }
  if (t.startsWith("/")) {
    if (typeof window !== "undefined" && window.location) {
      return { kind: "http", url: `${window.location.origin}${t}` };
    }
    return { kind: "http", url: t };
  }
  const path = t.replace(/^\.\//, "");
  if (!looksLikeClassicImageSource(path) && !looksLikeClassicImageSource(t)) {
    return { kind: "opaqueString", raw: t };
  }
  if (typeof window !== "undefined" && window.location) {
    return { kind: "http", url: `${window.location.origin}/${path}` };
  }
  const base =
    typeof process !== "undefined" && process.env.PUBLIC_URL
      ? process.env.PUBLIC_URL.replace(/\/$/, "")
      : "";
  const abs = `${base}/${path}`.replace(/([^:]\/)\/+/g, "$1");
  return { kind: "http", url: abs };
}

/**
 * @param {string} gsUrl
 * @returns {string | null} ruta del objeto dentro del bucket (para ref(storage, path))
 */
export function gsUrlToStorageObjectPath(gsUrl) {
  const m = /^gs:\/\/[^/]+\/(.+)$/.exec(gsUrl.trim());
  return m ? decodeURIComponent(m[1]) : null;
}
