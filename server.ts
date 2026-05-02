import express, { Request, Response } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import * as XLSX from "xlsx";
import mammoth from "mammoth";

interface MulterRequest extends Request {
  file?: Express.Multer.File;
}
import Database from "better-sqlite3";
import * as cheerio from "cheerio";
import axios from "axios";
import Papa from "papaparse";
import fs from "fs";
import knex, { Knex } from "knex";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(":memory:");
const upload = multer({ dest: "uploads/" });

// Storage for active external connections
const activeConnections: Record<string, Knex> = {};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // Metadata for tables
  const tablesMetadata: Record<string, any> = {};

  // GET /api/tables
  app.get("/api/tables", (req, res) => {
    res.json({ tables: Object.values(tablesMetadata) });
  });

  // POST /api/upload-csv (handles CSV, XLSX, JSON)
  app.post("/api/upload-csv", upload.single("file"), async (req: MulterRequest, res: Response) => {
    try {
      if (!req.file) throw new Error("No file uploaded");
      
      let data: any[] = [];
      let columns: string[] = [];
      const extension = path.extname(req.file.originalname).toLowerCase();

      if (extension === ".csv") {
        const csvData = fs.readFileSync(req.file.path, "utf8");
        const parsed = Papa.parse(csvData, { header: true, skipEmptyLines: true });
        data = parsed.data;
        columns = parsed.meta.fields || [];
      } else if (extension === ".xlsx" || extension === ".xls") {
        const fileBuffer = fs.readFileSync(req.file.path);
        const workbook = XLSX.read(fileBuffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        data = XLSX.utils.sheet_to_json(sheet);
        if (data.length > 0) {
          columns = Object.keys(data[0]);
        }
      } else if (extension === ".json") {
        const jsonData = fs.readFileSync(req.file.path, "utf8");
        data = JSON.parse(jsonData);
        if (!Array.isArray(data)) throw new Error("JSON must be an array of objects");
        if (data.length > 0) {
          columns = Object.keys(data[0]);
        }
      } else if (extension === ".docx") {
        const docBuffer = fs.readFileSync(req.file.path);
        const result = await mammoth.extractRawText({ buffer: docBuffer });
        const text = result.value;
        const lines = text.split("\n").filter(l => l.trim() !== "");
        data = lines.map(line => ({ Content: line.trim() }));
        columns = ["Content"];
      } else if (extension === ".txt") {
        const textData = fs.readFileSync(req.file.path, "utf8");
        const lines = textData.split("\n").filter(l => l.trim() !== "");
        // Detect if it might be CSV-like
        if (lines.length > 0 && lines[0].includes(",") && lines.length > 1) {
           const parsed = Papa.parse(textData, { header: true, skipEmptyLines: true });
           data = parsed.data;
           columns = parsed.meta.fields || [];
        } else {
           data = lines.map(line => ({ Content: line.trim() }));
           columns = ["Content"];
        }
      } else {
        throw new Error("Unsupported file format. Supported: CSV, Excel, JSON, Word (.docx), Text (.txt)");
      }

      if (data.length === 0) throw new Error("File is empty or could not be parsed");

      const sanitizedTableName = `table_${Date.now()}`;
      
      // Create table
      const colDefinitions = columns.map(col => `"${col}" TEXT`).join(", ");
      db.prepare(`CREATE TABLE "${sanitizedTableName}" (${colDefinitions})`).run();

      // Insert data
      const placeholders = columns.map(() => "?").join(", ");
      const insertStmt = db.prepare(`INSERT INTO "${sanitizedTableName}" VALUES (${placeholders})`);
      
      const insertMany = db.transaction((rows) => {
        for (const row of rows) {
          const values = columns.map(col => row[col] || "");
          insertStmt.run(values);
        }
      });

      insertMany(data);

      const metadata = {
        name: sanitizedTableName,
        columns,
        rowCount: data.length,
        sample: data.slice(0, 5),
        stats: columns.reduce((acc: any, col) => {
          const values = data.map(row => row[col]);
          const missing = values.filter(v => v === undefined || v === null || v === "").length;
          const nonMissing = values.filter(v => v !== undefined && v !== null && v !== "");
          
          let type = "Text";
          if (nonMissing.length > 0) {
            const isNumeric = nonMissing.every(v => !isNaN(Number(v)));
            if (isNumeric) type = "Number";
            const isDate = nonMissing.every(v => !isNaN(Date.parse(v)) && String(v).includes("-"));
            if (isDate) type = "Date";
          }
          
          acc[col] = { missing, type };
          return acc;
        }, {})
      };
      
      tablesMetadata[sanitizedTableName] = { name: sanitizedTableName, metadata };

      res.json({ success: true, tableName: sanitizedTableName, metadata });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    } finally {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    }
  });

  // POST /api/sql-run
  app.post("/api/sql-run", async (req, res) => {
    const { query, connectionId } = req.body;
    try {
      if (!query) throw new Error("Query is required");
      
      // More robust check for read-only queries
      const cleanQuery = query.replace(/(\/\*[\s\S]*?\*\/)|(--.*)/g, "").trim().toLowerCase();
      const isAllowed = cleanQuery.startsWith("select") || 
                        cleanQuery.startsWith("with") || 
                        cleanQuery.startsWith("show") || 
                        cleanQuery.startsWith("describe") ||
                        cleanQuery.startsWith("explain");

      if (!isAllowed) {
        throw new Error("Only read-only queries (SELECT, WITH, SHOW, etc.) are allowed for security reasons.");
      }

      if (connectionId && activeConnections[connectionId]) {
        const k = activeConnections[connectionId];
        const rows = await k.raw(query);
        // Knex returns different formats based on dialect
        // mysql2 returns [rows, fields]
        // pg returns {rows, ...}
        let results = rows;
        if (Array.isArray(rows) && rows.length > 0 && Array.isArray(rows[0])) {
          results = rows[0]; // MySQL style
        } else if (rows && rows.rows) {
          results = rows.rows; // Postgres style
        }
        return res.json({ results });
      }
      
      const results = db.prepare(query).all();
      res.json({ results });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/db-connect
  app.post("/api/db-connect", async (req, res) => {
    const { type, host, port, user, password, database, ssl } = req.body;
    try {
      const connectionId = `conn_${Date.now()}`;
      
      const k = knex({
        client: type, // 'pg' or 'mysql2'
        connection: {
          host,
          port: Number(port),
          user,
          password,
          database,
          ssl: ssl ? { rejectUnauthorized: false } : false
        },
        acquireConnectionTimeout: 10000
      });

      // Test connection
      await k.raw("SELECT 1");
      
      // Get tables and their schemas
      let tables: any[] = [];
      if (type === "pg") {
        const res = await k.raw("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
        tables = res.rows.map((r: any) => r.table_name);
      } else if (type === "mysql2") {
        const res = await k.raw("SHOW TABLES");
        const key = Object.keys(res[0][0])[0];
        tables = res[0].map((r: any) => r[key]);
      }

      const datasets = await Promise.all(tables.map(async (name) => {
        let columns: string[] = [];
        if (type === "pg") {
          const colRes = await k.raw(`SELECT column_name FROM information_schema.columns WHERE table_name = '${name}'`);
          columns = colRes.rows.map((r: any) => r.column_name);
        } else if (type === "mysql2") {
          const colRes = await k.raw(`DESCRIBE ${name}`);
          columns = colRes[0].map((r: any) => r.Field);
        }
        
        return {
          id: name,
          name: name,
          metadata: {
            columns,
            rowCount: -1, // Unknown for external
            sample: [],
            stats: {}
          },
          isExternal: true
        };
      }));

      activeConnections[connectionId] = k;
      res.json({ success: true, connectionId, datasets });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/create-table
  app.post("/api/create-table", (req, res) => {
    const { tableName, data } = req.body;
    try {
      if (!tableName || !data || !Array.isArray(data)) {
        throw new Error("tableName and data array are required");
      }

      const sanitizedTableName = tableName.replace(/[^a-z0-9_]/gi, "_").toLowerCase();
      const columns = Object.keys(data[0]);

      db.prepare(`DROP TABLE IF EXISTS ${sanitizedTableName}`).run();
      const createStmt = `CREATE TABLE ${sanitizedTableName} (${columns.map(c => `"${c}" TEXT`).join(", ")})`;
      db.prepare(createStmt).run();

      const insertStmt = db.prepare(`INSERT INTO ${sanitizedTableName} (${columns.map(c => `"${c}"`).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`);
      
      const insertMany = db.transaction((rows) => {
        for (const row of rows) {
          const vals = columns.map(c => row[c]);
          insertStmt.run(vals);
        }
      });
      insertMany(data);

      const metadata = {
        name: sanitizedTableName,
        columns,
        rowCount: data.length,
        sample: data.slice(0, 5),
        stats: columns.reduce((acc: any, col) => {
          const values = data.map(row => row[col]);
          const missing = values.filter(v => v === undefined || v === null || v === "").length;
          const nonMissing = values.filter(v => v !== undefined && v !== null && v !== "");
          
          let type = "Text";
          if (nonMissing.length > 0) {
            const isNumeric = nonMissing.every(v => !isNaN(Number(v)));
            if (isNumeric) type = "Number";
          }
          
          acc[col] = { missing, type };
          return acc;
        }, {})
      };

      tablesMetadata[sanitizedTableName] = { name: sanitizedTableName, metadata };
      res.json({ success: true, tableName: sanitizedTableName, metadata });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/scrape-pre-scan
  app.post("/api/scrape-pre-scan", async (req, res) => {
    const { url } = req.body;
    try {
      const response = await axios.get(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36" },
        timeout: 8000
      });
      const $ = cheerio.load(response.data);
      $("script, style, nav, footer, header").remove();
      const text = $("body").text().substring(0, 5000);
      res.json({ text });
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  // POST /api/scrape
  app.post("/api/scrape", async (req, res) => {
    const { url, mode, jsRender, paginationDepth, proxyEnabled } = req.body;
    try {
      const userAgents = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
      ];

      const response = await axios.get(url, {
        headers: { 
          "User-Agent": userAgents[Math.floor(Math.random() * userAgents.length)],
          "Accept-Language": "en-US,en;q=0.9",
          "Referer": "https://www.google.com/"
        },
        timeout: 15000
      });
      
      const $ = cheerio.load(response.data);
      let results: any = {};
      let html = "";

      if (mode === "smart") {
        // Clean HTML for token efficiency
        $("script, style, svg, path, nav, footer, header, iframe").remove();
        html = $("body").html()?.substring(0, 18000) || ""; 
      } else {
        if (mode === "text" || mode === "auto") {
          results.text = $("p").map((i, el) => $(el).text()).get().slice(0, 50).join("\n");
        }
        if (mode === "links" || mode === "auto") {
          results.links = $("a").map((i, el) => ({ text: $(el).text(), href: $(el).attr("href") })).get().slice(0, 20);
        }
        if (mode === "tables" || mode === "auto") {
          const tables: any[] = [];
          $("table").each((i, table) => {
            const rows: any[] = [];
            $(table).find("tr").each((j, tr) => {
              const cols = $(tr).find("th, td").map((k, td) => $(td).text().trim()).get();
              if (cols.length > 0) rows.push(cols);
            });
            if (rows.length > 3) tables.push(rows);
          });
          results.tables = tables;
        }
      }

      res.json({ results, html });
    } catch (error: any) {
      console.error(error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
