import compression from "compression";
import express from "express";
import morgan from "morgan";
import { fileURLToPath } from "url";
import path from "path";
import * as fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(compression());
app.use(morgan("tiny"));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Vite assets in development
if (process.env.NODE_ENV === "development") {
  const vite = await import("vite");
  const viteServer = await vite.createServer();
  app.use(viteServer.middlewares);
}

// Static files
const buildPath = path.join(__dirname, "build");
if (fs.existsSync(buildPath)) {
  app.use(express.static(buildPath, { maxAge: "1h" }));
}

// Remix handler
const remixBuild = await import("./build/index.js");
app.all("*", express.json(), async (req, res, next) => {
  try {
    return remixBuild.default(req, res, next);
  } catch (error) {
    next(error);
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`App is running on http://localhost:${port}`);
});
