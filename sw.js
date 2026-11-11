const BASE_DIR = new URL("./", self.location.href).href;

function getAsset(path) {
    return BASE_DIR + String(path).replace(/^\//, "");
}

importScripts(getAsset("sj/jet.sw.js"));

self.addEventListener("install", () => {
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "OPM:claim") {
        event.waitUntil(self.clients.claim().catch(() => {}));
    }
});

const XO = {
    "Cross-Origin-Embedder-Policy": "credentialless",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "cross-origin"
};

const wantsDocument = (req) =>
    req.mode === "navigate" ||
    ["document", "iframe", "frame", "embed", "object"].includes(req.destination);

function withIsolation(res, request) {
    try {
        if (!res || !wantsDocument(request)) return res;
        if (res.type === "opaque" || res.type === "opaqueredirect" || res.type === "error") return res;
        if (res.headers && res.headers.has("Cross-Origin-Embedder-Policy")) return res;
        const h = new Headers(res.headers);
        h.set("Cross-Origin-Embedder-Policy", "credentialless");
        h.set("Cross-Origin-Opener-Policy", "same-origin");
        h.set("Cross-Origin-Resource-Policy", "cross-origin");
        return new Response(res.body, {
            status: res.status,
            statusText: res.statusText,
            headers: h
        });
    } catch (e) {
        return res;
    }
}

function isIdbNotFound(e) {
    const s = (e && e.message ? e.message : String(e)) || "";
    if (!/NotFound/i.test(s)) return false;
    if (/cache/i.test(s)) return false;
    return /IDB|IndexedDB|IDBDatabase|IDBObjectStore|'transaction' on|'open' on|deleteDatabase|object store/i.test(s);
}

async function isNextDnsSslError(res) {
    if (!res || res.status !== 500) return false;
    try {
        const text = await res.clone().text();
        return /error code 60/i.test(text) && /SSL peer certificate/i.test(text);
    } catch (e) {
        return false;
    }
}

async function cleanup() {
    try {
        const delDb = (name) =>
            new Promise((res) => {
                const req = indexedDB.open(name);
                const finish = () => {
                    const d = indexedDB.deleteDatabase(name);
                    d.onsuccess = d.onerror = d.onblocked = res;
                };
                req.onsuccess = () => {
                    try { req.result.close(); } catch (e) {}
                    finish();
                };
                req.onerror = finish;
            });
        await delDb("__jet_controller");
        const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        await self.registration.unregister();
        for (const c of clientsList) {
            c.navigate(c.url);
        }
    } catch (err) {}
}

self.addEventListener("error", (event) => {
    if (isIdbNotFound(event.error || event)) {
        try { event.preventDefault(); } catch (e) {}
        cleanup();
    }
});

self.addEventListener("unhandledrejection", (event) => {
    if (isIdbNotFound(event.reason || event)) {
        try { event.preventDefault(); } catch (e) {}
        cleanup();
    }
});

self.addEventListener("fetch", (event) => {
    event.respondWith((async () => {
        const reqUrl = new URL(event.request.url);
        if (reqUrl.pathname.endsWith("/__sw_alive")) {
            return new Response("true", {
                headers: Object.assign({}, XO, { "Content-Type": "text/plain" })
            });
        }

        try {
            if ($jetController.shouldRoute(event)) {
                const sjRes = await $jetController.route(event);
                if (await isNextDnsSslError(sjRes)) {
                    if (!wantsDocument(event.request)) {
                        return new Response("", { status: 204 });
                    }
                }
                return withIsolation(sjRes, event.request);
            }
        } catch (e) {
            if (isIdbNotFound(e)) {
                cleanup();
            }
        }

        if (reqUrl.pathname.includes("/~/")) {
            try {
                const clientsList = await self.clients.matchAll({ includeUncontrolled: true });
                for (const c of clientsList) {
                    c.postMessage({ $controller$swrevive: {} });
                }
            } catch (e) {}

            for (let i = 0; i < 15; i++) {
                if ($jetController.shouldRoute(event)) {
                    try {
                        const sjRes2 = await $jetController.route(event);
                        if (await isNextDnsSslError(sjRes2)) {
                            if (!wantsDocument(event.request)) {
                                return new Response("", { status: 204 });
                            }
                        }
                        return withIsolation(sjRes2, event.request);
                    } catch (e) {
                        break;
                    }
                }
                await new Promise((r) => setTimeout(r, 80));
            }

            if (!wantsDocument(event.request)) {
                return new Response("", {
                    status: 503,
                    headers: Object.assign({}, XO, { "Cache-Control": "no-store", "Retry-After": "1" })
                });
            }
            return new Response(
                '<!DOCTYPE html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="1"></head><body style="margin:0;background:#2d2635;color:#d2b8ff;font:15px system-ui,sans-serif;display:grid;place-items:center;height:100vh"><div>Warming up lightspeed proxy, please wait...</div></body></html>',
                {
                    status: 503,
                    headers: Object.assign({}, XO, {
                        "Content-Type": "text/html; charset=utf-8",
                        "Cache-Control": "no-store"
                    })
                }
            );
        }

        if (reqUrl.origin === self.location.origin && (reqUrl.pathname.endsWith("/icon.svg") || reqUrl.pathname.endsWith("/younis.svg"))) {
            return fetch(getAsset("lightspeed.svg"), { cache: "no-cache" });
        }
        if (reqUrl.origin === self.location.origin && /\.(svg|html)$/i.test(reqUrl.pathname)) {
            return fetch(event.request, { cache: "no-cache" });
        }

        return fetch(event.request);
    })());
});
