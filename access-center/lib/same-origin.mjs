// Comprobacion de Host/Origin compartida por las rutas de access-center que
// mutan estado y solo tienen un llamador legitimo: una pagina servida por
// este mismo servidor (ver access-center/approvals-routes.mjs, que ya la
// usaba desde antes para /api/jarvis/approvals/**).
//
// Esto NO es autenticacion (un proceso de loopback puede falsificar Origin
// con curl) — frena concretamente CSRF desde una pagina web de otro origen
// (otra pestana del navegador) y DNS rebinding, que es lo que un navegador
// real nunca deja falsificar. Alcance documentado en approvals-routes.mjs.
export function createSameOriginGuard(port) {
  const hosts = [`localhost:${port}`, `127.0.0.1:${port}`];
  const hostOk = (req) => hosts.includes(req.get("host"));
  const sameOrigin = (req) => {
    const origin = req.get("origin");
    if (!origin || !hostOk(req) || origin !== `http://${req.get("host")}`) return false;
    const site = req.get("sec-fetch-site");
    return !site || site === "same-origin";
  };
  return { hostOk, sameOrigin };
}
