import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// 🔥 esto ejecuta index.ts y registra tools
import "./index";

const app = express();
app.use(express.json());

const server = new McpServer({
  name: "garmin-mcp",
  version: "1.0.0"
});

app.post("/mcp", async (req, res) => {
  try {
    const result = await server.handleRequest(req.body);
    res.json(result);
  } catch (e: any) {
    console.error("❌ MCP ERROR FULL:", e);
    res.status(500).json({ error: e.message });
  }
});

app.get("/", (_, res) => {
  res.send("MCP HTTP wrapper alive 🧠");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("MCP HTTP wrapper running");
});
