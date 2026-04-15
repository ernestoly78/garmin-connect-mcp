import express from "express";

// 🔥 IMPORTANTE: importar el build real
import * as mcpModule from "./index.cjs";

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  try {
    // 🔥 usa el server exportado o inicializa correctamente
    if (!mcpModule || !mcpModule.default) {
      throw new Error("MCP not initialized correctly");
    }

    const server = mcpModule.default;

    const result = await server.handleRequest(req.body);

    res.json(result);

  } catch (e: any) {
    console.error("❌ MCP ERROR:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/", (_, res) => {
  res.send("MCP HTTP wrapper alive 🧠");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("MCP HTTP wrapper running");
});
