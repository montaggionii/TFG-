import test from "node:test";
import assert from "node:assert/strict";
import { createSameOriginGuard } from "../lib/same-origin.mjs";

const PORT = 5757;

function fakeReq(headers) {
  const lower = {};
  for (const [k, v] of Object.entries(headers)) lower[k.toLowerCase()] = v;
  return { get: (name) => lower[name.toLowerCase()] };
}

test("hostOk acepta localhost y 127.0.0.1 en el puerto configurado, nada mas", () => {
  const { hostOk } = createSameOriginGuard(PORT);
  assert.equal(hostOk(fakeReq({ host: `localhost:${PORT}` })), true);
  assert.equal(hostOk(fakeReq({ host: `127.0.0.1:${PORT}` })), true);
  assert.equal(hostOk(fakeReq({ host: `localhost:9999` })), false);
  assert.equal(hostOk(fakeReq({ host: `evil.com` })), false);
  assert.equal(hostOk(fakeReq({})), false);
});

test("sameOrigin acepta un fetch same-origin real de la propia pagina", () => {
  const { sameOrigin } = createSameOriginGuard(PORT);
  assert.equal(
    sameOrigin(fakeReq({ host: `localhost:${PORT}`, origin: `http://localhost:${PORT}` })),
    true
  );
  assert.equal(
    sameOrigin(
      fakeReq({
        host: `127.0.0.1:${PORT}`,
        origin: `http://127.0.0.1:${PORT}`,
        "sec-fetch-site": "same-origin",
      })
    ),
    true
  );
});

test("sameOrigin rechaza CSRF desde otro origen aunque el Host sea el correcto", () => {
  const { sameOrigin } = createSameOriginGuard(PORT);
  assert.equal(
    sameOrigin(fakeReq({ host: `localhost:${PORT}`, origin: "http://evil.com" })),
    false
  );
});

test("sameOrigin rechaza una peticion sin cabecera Origin (curl/script sin navegador)", () => {
  const { sameOrigin } = createSameOriginGuard(PORT);
  assert.equal(sameOrigin(fakeReq({ host: `localhost:${PORT}` })), false);
});

test("sameOrigin rechaza Origin que no coincide con el Host aunque ambos sean validos", () => {
  const { sameOrigin } = createSameOriginGuard(PORT);
  assert.equal(
    sameOrigin(
      fakeReq({ host: `localhost:${PORT}`, origin: `http://127.0.0.1:${PORT}` })
    ),
    false
  );
});

test("sameOrigin rechaza Sec-Fetch-Site distinto de same-origin aunque Origin coincida", () => {
  const { sameOrigin } = createSameOriginGuard(PORT);
  assert.equal(
    sameOrigin(
      fakeReq({
        host: `localhost:${PORT}`,
        origin: `http://localhost:${PORT}`,
        "sec-fetch-site": "cross-site",
      })
    ),
    false
  );
});
