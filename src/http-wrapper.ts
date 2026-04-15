import express from "express";
import { spawn } from "child_process";

const app = express();
app.use(express.json());

// ===============================
// 🧠 MCP PERSISTENTE (UNA VEZ)
// ===============================
let mcp: ReturnType<typeof spawn> | null = null;

// mapa de callbacks por id (json-rpc)
const pending = new Map<
  number,
  (payload: any) => void
>();

// buffer para reconstruir mensajes por línea
let stdoutBuffer = "";

// iniciar MCP una sola vez
function startMcp() {
  console.log("🚀 Starting MCP process (persistent)");

  mcp = spawn("node", ["dist/index.cjs"]);

  // stdout: respuestas JSON-RPC
  mcp.stdout.on("data", (chunk: Buffer) => {
    const text = chunk.toString();
    stdoutBuffer += text;

    // procesar por líneas
    let lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const msg = JSON.parse(line);

        // 👇 esperamos respuestas con id
        if (msg.id && pending.has(msg.id)) {
          const resolve = pending.get(msg.id)!;
          pending.delete(msg.id);
          resolve(msg);
        } else {
          console.log("📤 MCP (unhandled):", line);
        }
      } catch (e) {
        console.error("❌ JSON PARSE ERROR:", line);
      }
    }
  });

  // stderr: logs del MCP (incluye login)
  mcp.stderr.on("data", (data: Buffer) => {
    const txt = data.toString();
    console.error("🪵 MCP LOG:", txt);

    // señal útil para ver re-logins
    if (txt.includes("Authenticating with Garmin Connect")) {
      console.error("🚨 MCP está re-autenticando");
    }
  });

  mcp.on("close", (code) => {
    console.error("💀 MCP process closed:", code);
    mcp = null;
    // opcional: auto-restart
    setTimeout(startMcp, 2000);
  });
}

startMcp();

// ===============================
// 🧠 RATE LIMIT SUAVE + CACHE
// ===============================
let lastCallTime = 0;
const MIN_INTERVAL = 1500; // 1.5s

let lastResponse: any = null;
let lastResponseTime = 0;
const CACHE_TTL = 60 * 1000; // 1 min

// ===============================
// 🔌 ENDPOINT MCP
// ===============================
app.post("/mcp", async (req, res) => {
  try {
    console.log("\n================ MCP REQUEST ================");
    console.log("📥 BODY:", JSON.stringify(req.body, null, 2));

    const now = Date.now();

    // rate limit wrapper
    if (now - lastCallTime < MIN_INTERVAL) {
      console.log("⛔ WRAPPER RATE LIMIT");

      if (lastResponse) {
        console.log("⚡ RETURNING CACHED RESPONSE");
        return res.json(lastResponse);
      }

      return res.status(429).json({
        error: "wrapper_rate_limited"
      });
    }

    // cache
    if (lastResponse && now - lastResponseTime < CACHE_TTL) {
      console.log("⚡ USING WRAPPER CACHE");
      return res.json(lastResponse);
    }

    lastCallTime = now;

    if (!mcp) {
      return res.status(500).json({
        error: "mcp_not_running"
      });
    }

    // generar id único si no viene
    const id = req.body.id ?? Math.floor(Math.random() * 1e9);

    const payload = {
      ...req.body,
      id
    };

    // promesa que se resuelve cuando llega respuesta
    const responsePromise = new Promise((resolve, reject) => {
      pending.set(id, resolve);

      // timeout de seguridad
      setTimeout(() => {
        if (pending.has(id)) {
          pending.delete(id);
          reject(new Error("MCP timeout"));
        }
      }, 15000);
    });

    // enviar request al MCP
    mcp.stdin.write(JSON.stringify(payload) + "\n");

    const result: any = await responsePromise;

    console.log("✅ MCP RESPONSE:", JSON.stringify(result, null, 2));

    // detectar 429 dentro del contenido
    const text = result?.result?.content?.[0]?.text;
    if (text && text.includes("429")) {
      console.log("🚨 GARMIN 429 DETECTED");

      if (lastResponse) {
        console.log("⚡ USING PREVIOUS RESPONSE");
        return res.json(lastResponse);
      }

      return res.json({
        error: "garmin_rate_limit"
      });
    }

    // guardar cache
    lastResponse = result;
    lastResponseTime = Date.now();

    res.json(result);

  } catch (e: any) {
    console.error("❌ WRAPPER ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

// health
app.get("/", (_, res) => {
  res.send("MCP wrapper alive 🧠");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 HTTP wrapper running");
});
