const STATIC_CACHE = "static-v1";
const RUNTIME_CACHE = "runtime-v1";

const APP_SHELL = ["/", "/index.html", "/manifest.json"];

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Solo GET
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Evitar esquemas no soportados (chrome-extension:, data:, blob:, etc.)
  if (url.protocol !== "http:" && url.protocol !== "https:") return;

  // (Opcional) Ignorar rutas de HMR/dev para evitar loops en desarrollo
  if (url.pathname.startsWith("/@vite") || url.pathname.startsWith("/__vite"))
    return;

  // Navegación SPA (app shell)
  if (request.mode === "navigate" && url.origin === self.location.origin) {
    event.respondWith(
      caches.match("/index.html").then((cached) => cached || fetch(request))
    );
    return;
  }

  // Reglas específicas
  if (
    url.hostname === "raw.githubusercontent.com" &&
    url.pathname.includes("/PokeAPI/sprites/")
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (url.hostname.endsWith("pokeapi.co")) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Default
  event.respondWith(networkFallingBackToCache(request));
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => ![STATIC_CACHE, RUNTIME_CACHE].includes(k))
            .map((k) => caches.delete(k))
        )
      )
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (!event.data) return;
  console.log("[SW] message received:", event.data);

  if (event.data.type === "SHOW_NOTIFICATION") {
    const title = event.data.title || "¡Pokédex!";
    const options = {
      body: event.data.body || "Notificación local",
      icon: event.data.icon || "/icons/icon-192.png",
      tag: event.data.tag || "pokedex-local",
      renotify: true,
      data: { url: event.data.url || "/" },
      actions: [{ action: "open", title: "Abrir" }],
    };
    event.waitUntil(self.registration.showNotification(title, options));
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    (event.notification &&
      event.notification.data &&
      event.notification.data.url) ||
    "/";

  // Soporta acción específica si usas actions
  if (event.action === "open") {
    event.waitUntil(clients.openWindow(targetUrl));
    return;
  }

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of allClients) {
        const url = new URL(client.url);
        if (
          url.pathname === targetUrl ||
          url.pathname === "/" ||
          targetUrl === "/"
        ) {
          client.focus();
          return;
        }
      }
      await clients.openWindow(targetUrl);
    })()
  );
});

function isHttpRequest(request) {
  const p = new URL(request.url).protocol;
  return p === "http:" || p === "https:";
}

async function cacheFirst(request) {
  if (!isHttpRequest(request)) return fetch(request);
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const resp = await fetch(request);
  try {
    await cache.put(request, resp.clone());
  } catch {}
  return resp;
}

async function staleWhileRevalidate(request) {
  if (!isHttpRequest(request)) return fetch(request);
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then(async (resp) => {
      try {
        await cache.put(request, resp.clone());
      } catch {}
      return resp;
    })
    .catch(() => cached || new Response(null, { status: 504 }));
  return cached ? cached : networkPromise;
}

async function networkFallingBackToCache(request) {
  if (!isHttpRequest(request)) return fetch(request);
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const resp = await fetch(request);
    try {
      await cache.put(request, resp.clone());
    } catch {}
    return resp;
  } catch {
    const cached = await cache.match(request);
    return (
      cached ||
      new Response("Offline y recurso no en caché.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}
