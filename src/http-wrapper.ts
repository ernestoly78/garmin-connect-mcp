import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

// ⚠️ importa donde registras tus tools
import "./index.js";

const app = express();
app.use(express.json());

// 🔥 endpoint MCP
app.post("/mcp", async (req, res) => {
  try {
    const server = new McpServer({
      name: "garmin-mcp",
      version: "1.0.0"
    });

    const result = await server.handleRequest(req.body);

    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "MCP error" });
  }
});

app.get("/", (_, res) => {
  res.send("MCP HTTP wrapper alive 🧠");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("MCP HTTP wrapper running");
});
