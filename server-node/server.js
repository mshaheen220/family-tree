import "dotenv/config";
import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import { pipeline } from "@xenova/transformers";
import * as lancedb from "@lancedb/lancedb";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { DatabaseSync } from "node:sqlite";


// ES Module fix for __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const activeRootId = process.argv[2] || process.env.ROOT_ID || '';
const cleanActiveRootId = activeRootId.replace(/@/g, '');

if (!cleanActiveRootId) {
  console.warn("\n⚠️ WARNING: No ROOT_ID provided to server. Ensure you start with a target ID.");
} else {
  console.log(`\n🎯 Genealogy Agent targeted to Realm: ${cleanActiveRootId}`);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allows your visual app to connect from any local port
    methods: ["GET", "POST"]
  }
});

// Serve the config
app.get('/api/config', (req, res) => {
  res.json({ rootId: cleanActiveRootId });
});

// Serve the active GEDCOM
app.get('/api/gedcom', (req, res) => {
  if (!cleanActiveRootId) {
    return res.status(400).send("No active ROOT_ID configured on the server.");
  }
  const filePath = path.resolve(__dirname, `../data/${cleanActiveRootId}/family_tree_filtered.ged`);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send(`Filtered GEDCOM not found at ${filePath}. Did you run the pipeline?`);
  }
});

// Global AI Variables
let generateEmbedding, llm;
const dbCache = {}; // Cache for { dbTable, dbSql } per rootId

async function getDatabases() {
  if (!cleanActiveRootId) throw new Error("No active ROOT_ID provided. Start the server with a ROOT_ID.");
  if (dbCache[cleanActiveRootId]) return dbCache[cleanActiveRootId];

  const dbDir = path.resolve(__dirname, `../data/${cleanActiveRootId}`);
  if (!fs.existsSync(dbDir)) {
    throw new Error(`Data directory not found for ${cleanActiveRootId}`);
  }

  const db = await lancedb.connect(path.join(dbDir, "vector_store"));
  const dbTable = await db.openTable("genealogy_profiles");
  const dbSql = new DatabaseSync(path.join(dbDir, "genealogy.db"));
  
  dbSql.exec(`
    CREATE TABLE IF NOT EXISTS cleanup_suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT,
      suggestion TEXT,
      task_id TEXT,
      completed INTEGER DEFAULT 0
    )
  `);
  try { dbSql.exec("ALTER TABLE cleanup_suggestions ADD COLUMN completed INTEGER DEFAULT 0"); } catch (e) {}
  try { dbSql.exec("ALTER TABLE cleanup_suggestions ADD COLUMN task_id TEXT"); } catch (e) {}

  dbCache[cleanActiveRootId] = { dbTable, dbSql };
  return dbCache[cleanActiveRootId];
}

// Initialize AI Models & Database
async function initAI() {
  console.log(`Loading AI models...`);
  generateEmbedding = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");

  llm = new ChatGoogleGenerativeAI({
    model: "gemini-2.5-flash-lite",
    temperature: 0,
    maxRetries: 1
  });
  console.log("✅ AI ready!");
}
initAI().catch(console.error);

io.on("connection", (socket) => {
  console.log("🟢 Client connected:", socket.id);

  // Give the agent short-term memory for this specific user session
  const chatHistory = [];

  // Triage Dashboard Listeners
  socket.on("get-cleanups", async () => {
    try {
      const { dbSql } = await getDatabases();
      const rows = dbSql.prepare("SELECT * FROM cleanup_suggestions ORDER BY completed ASC, timestamp DESC").all();
      socket.emit("cleanups-data", rows);
    } catch (e) {
      console.error("Error fetching cleanups:", e.message);
    }
  });

  socket.on("toggle-cleanup", async (data) => {
    try {
      const { dbSql } = await getDatabases();
      dbSql.prepare("UPDATE cleanup_suggestions SET completed = ? WHERE id = ?").run(data.completed, data.id);
      // Emit the fresh list back to the client immediately
      const rows = dbSql.prepare("SELECT * FROM cleanup_suggestions ORDER BY completed ASC, timestamp DESC").all();
      socket.emit("cleanups-data", rows);
    } catch (e) {
      console.error("Error toggling cleanup:", e.message);
    }
  });

  socket.on("delete-cleanup", async (data) => {
    try {
      const { dbSql } = await getDatabases();
      dbSql.prepare("DELETE FROM cleanup_suggestions WHERE id = ?").run(data.id);
      // Emit the fresh list back to the client immediately
      const rows = dbSql.prepare("SELECT * FROM cleanup_suggestions ORDER BY completed ASC, timestamp DESC").all();
      socket.emit("cleanups-data", rows);
    } catch (e) {
      console.error("Error deleting cleanup:", e.message);
    }
  });

  socket.on("transcription", async (data) => {
    const { text, rootId } = data;
    console.log(`\n🗣️  User said: "${text}" for target person: ${rootId}`);
    
    if (!generateEmbedding || !llm) {
      socket.emit("answer", "Still initializing AI... please wait a moment.");
      return;
    }

    let dbTable, dbSql;
    try {
      ({ dbTable, dbSql } = await getDatabases());
    } catch (err) {
      socket.emit("answer", "I don't have an AI index built for this person yet! Try running the pipeline.");
      return;
    }

    // Fetch the full name of the person the user is actively viewing
    let targetPersonName = "the selected person";
    if (rootId) {
      try {
        // Try with the raw ID first (in case it includes @ symbols)
        let row = dbSql.prepare("SELECT full_name FROM individuals WHERE id = ?").get(rootId);
        if (!row) {
          const cleanTargetId = rootId.replace(/@/g, '');
          row = dbSql.prepare("SELECT full_name FROM individuals WHERE id = ?").get(cleanTargetId);
        }
        if (row && row.full_name) targetPersonName = row.full_name;
      } catch (e) {}
    }

    try {
      const historyText = chatHistory.length > 0 
        ? chatHistory.map(m => `${m.role === 'user' ? 'User' : 'Agent'}: ${m.content}`).join('\n') 
        : "No previous history.";

      // 1. Intelligent Routing (SQL vs Vector)
      const routerResponse = await llm.invoke([
        new SystemMessage(`You are an intelligent routing assistant for a genealogy database.

The user is currently viewing the profile of: ${targetPersonName}.

STEP 1: RESOLVE PRONOUNS AND PARTIAL NAMES
Look at the RECENT CONVERSATION HISTORY. If the user uses pronouns ("he", "she", "they", "them", "his", "her", "their") OR uses a first name without a last name, you MUST replace it with "${targetPersonName}" (or the specific person's full name from the previous turn) before routing!

STEP 2: CHOOSE THE ROUTE
- Use "sql" ONLY for global/aggregate math AND for counting specific metrics that explicitly exist as columns in the database (e.g., "how many children did Steven have", "how many siblings does Michael have"). NEVER use SQL for finding dates, ages, or individual facts. NEVER invent tables or columns.
- Use "gedcom" for ANY complex or multi-generational graph relationships, such as grandchildren, cousins, tracing lineages, or finding ancestors/descendants.
- Use "vector" for biographies, ages, dates, locations, stories, documents, or ANY specific attribute (like military records, education, occupations) that is not a simple direct column count.
- Use "vector" WITH EXACT QUERY "UNLINKED ORPHAN" ONLY IF the user asks broad questions about people "not in the tree", "orphans", or "anyone missing from our tree". NEVER use "UNLINKED ORPHAN" if the user is asking about a specific known person.

The SQLite database has two tables:
1. 'individuals': id TEXT, full_name TEXT, first_name TEXT, last_name TEXT, gender TEXT, birth_date TEXT, birth_year INTEGER, death_date TEXT, death_year INTEGER, child_count INTEGER, spouse_count INTEGER, sibling_count INTEGER
2. 'families': family_id TEXT, husband_id TEXT, husband_name TEXT, wife_id TEXT, wife_name TEXT, marriage_date TEXT, marriage_year INTEGER, divorce_date TEXT, divorce_year INTEGER, child_count INTEGER
If you must use SQL to search by name, ALWAYS use the full_name column with LIKE and wildcards (e.g., full_name LIKE '%Steven%') to account for misspellings. Do not split names into first_name and last_name.

RECENT CONVERSATION HISTORY:
${historyText}

Respond ONLY with a valid JSON object. Do not include markdown formatting.
{
  "type": "sql" | "vector" | "gedcom",
  "query": "The exact SQL query to run, OR a clean string of just the specific names/keywords for the vector database (e.g., 'Michael Shaheen' instead of 'Michael Shaheen information')"
}`),
        new HumanMessage(text)
      ]);

      let route;
      try {
        const cleanJson = routerResponse.content.replace(/```json/g, '').replace(/```/g, '').trim();
        route = JSON.parse(cleanJson);
      } catch (e) {
        console.warn("Router failed to output JSON, falling back to Vector Search.");
        route = { type: "vector", query: text };
      }

      if (route.type === "sql") {
        console.log(`📊 Routing to SQL Database: ${route.query}`);
        try {
          const sqlResults = dbSql.prepare(route.query).all();
          const contextText = JSON.stringify(sqlResults, null, 2);
          
          const aiResponse = await llm.invoke([
            new SystemMessage(`You are a helpful genealogy assistant. The user asked a question, and we automatically ran a SQL query to find the answer.

The user is currently viewing the profile of: ${targetPersonName}.

SQL QUERY RUN:
${route.query}

SQL RESULTS:
${contextText}

Assume the SQL results correctly answer the user's question. Formulate a polite, conversational response using ONLY these results. If it's a list of names, list them out naturally. If it's a count, state the number.`),
            ...chatHistory.map(m => m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)),
            new HumanMessage(text),
          ]);

          const sqlAnswerText = typeof aiResponse.content === 'string' ? aiResponse.content : (Array.isArray(aiResponse.content) ? aiResponse.content.map(p => p.text || '').join('') : String(aiResponse.content));
          console.log(`💡 Answer: ${sqlAnswerText}`);
          const uiAnswer = `${sqlAnswerText}<div class="answer-footer">⚙️ <b>Ran SQL:</b> <code>${route.query}</code></div>`;
          socket.emit("answer", uiAnswer);
          
          chatHistory.push({ role: "user", content: text });
          chatHistory.push({ role: "assistant", content: sqlAnswerText });
          if (chatHistory.length > 10) chatHistory.splice(0, chatHistory.length - 10);
        } catch (err) {
          console.error("SQL Execution Error:", err.message);
          socket.emit("answer", "I tried to query the database, but I encountered a SQL error.");
        }
        return; // End the request here so we don't also run the Vector Search!
      }

      if (route.type === "gedcom") {
        console.log(`🌳 Routing to Raw GEDCOM: ${route.query}`);
        try {
          const gedcomPath = path.resolve(__dirname, `../data/${cleanActiveRootId}/family_tree_filtered.ged`);
          const gedcomData = fs.readFileSync(gedcomPath, 'utf-8');
          
          const aiResponse = await llm.invoke([
            new SystemMessage(`You are a helpful genealogy assistant. The user asked a complex relationship question about ${targetPersonName}.

Read the provided RAW GEDCOM DATA to trace the family graph. 
To find grandchildren, look up the target person, find their FAMS (spouse families), look at those families' CHIL (children), and then follow those children to their own FAMS to count their CHIL!

RAW GEDCOM DATA:
${gedcomData}

Answer the user's question directly and conversationally. Detail the lineage (e.g., "She has 2 grandchildren: Michael and Jill, through her daughter Rebecca.").`),
            ...chatHistory.map(m => m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)),
            new HumanMessage(text),
          ]);

          const gedcomAnswerText = typeof aiResponse.content === 'string' ? aiResponse.content : (Array.isArray(aiResponse.content) ? aiResponse.content.map(p => p.text || '').join('') : String(aiResponse.content));
          console.log(`💡 Answer: ${gedcomAnswerText}`);
          const uiAnswer = `${gedcomAnswerText}<div class="answer-footer">🌳 <b>Traced from raw GEDCOM graph</b></div>`;
          socket.emit("answer", uiAnswer);
          
          chatHistory.push({ role: "user", content: text });
          chatHistory.push({ role: "assistant", content: gedcomAnswerText });
          if (chatHistory.length > 10) chatHistory.splice(0, chatHistory.length - 10);
        } catch (err) {
          console.error("GEDCOM Execution Error:", err.message);
          socket.emit("answer", "I tried to trace the family tree, but couldn't read the graph data.");
        }
        return;
      }

      console.log(`🔍 Routing to Vector Search: ${route.query}`);

      // 2. Embed user query (using optimized LLM query)
      const output = await generateEmbedding([route.query], { pooling: "mean", normalize: true });
      const queryVector = output.tolist()[0];

      // 2. Wide Vector Search (cast a wider net to find hidden names)
      const rawResults = await dbTable.search(queryVector).limit(150).toArray();
      
      if (rawResults.length === 0) {
         socket.emit("answer", "I couldn't find any relevant family tree data.");
         return;
      }

      // 3. Custom Hybrid Re-ranking (Keyword Boost)
      // Vector databases struggle with exact names. We artificially boost the relevance 
      // of chunks that contain the exact keywords (names) from the user's query.
      const stopWords = new Set(["how", "who", "what", "where", "when", "why", "did", "does", "is", "the", "and", "for", "with", "have", "has", "had", "was", "were", "are", "old", "many", "any", "all", "about", "information", "detail", "details"]);
      // Use the optimized router query, and explicitly strip possessive 's so names match properly!
      const queryWords = route.query.toLowerCase().replace(/'s\b/g, '').replace(/[^a-z0-9\s]/g, '').split(' ').filter(w => !stopWords.has(w) && w.length > 2);
      
      // LanceDB returns read-only proxies. Map them to new objects to calculate scores.
      let results = rawResults.map(r => {
        let keywordScore = 0;
        const chunkText = r.text.toLowerCase();
        const sourceName = r.source.toLowerCase();
        queryWords.forEach(w => {
          if (chunkText.includes(w)) keywordScore += 0.5; // Boost for text matches
          if (sourceName.includes(w)) keywordScore += 10.0; // MASSIVE boost to keep ALL chunks of the matched file together at the top!
        });
        
        return {
          text: r.text,
          source: r.source,
          _distance: r._distance,
          _hybridScore: r._distance - keywordScore
        };
      });

      // Sort by the new hybrid score and keep the top 30 to ensure we don't drop timeline chunks
      results.sort((a, b) => a._hybridScore - b._hybridScore);
      results = results.slice(0, 30);

      // Log the top 3 unique files retrieved so we can debug if the database found the right person!
      const topSources = Array.from(new Set(results.map(r => r.source))).slice(0, 3).join(", ");
      console.log(`🔍 Retrieved top sources: ${topSources}`);

      // 4. RAG with Gemini
      // Inject the filename into each chunk so the LLM always knows whose profile it is reading!
      const contextText = results.map(r => `[Source Profile: ${r.source}]\n${r.text}`).join("\n\n");
      const today = new Date().toDateString();
      const aiResponse = await llm.invoke([
        new SystemMessage(`You are a highly capable genealogy assistant. Answer the user's question using ONLY the provided FAMILY TREE DATA.

The user is currently asking about: ${targetPersonName}.

CRITICAL RULES FOR REASONING:
1. PHONETIC & NICKNAME MATCHING: You MUST actively match nicknames (e.g., "Judy" -> "Judith") and phonetic spellings (e.g., "Catherine" -> "Katherine").
2. MARRIED VS MAIDEN NAMES (CRITICAL): Women are stored by their MAIDEN names. If the user asks for a married woman (e.g., "Judith Heasley"), you MUST find a woman named "Judith" who is married to a "Heasley". NEVER reject a woman just because her profile name (maiden) differs from the requested married name! When stating ANY woman's name (even if she is just a child or sibling) in your final answer, you MUST check her own profile's "Spouses:" list. If she is married, you MUST use her husband's last name (e.g., call her "Amanda Shaheen", not "Amanda Heasley").
3. SPOUSE CROSS-REFERENCING: If asked about a marriage, look at the "Spouses:" section of BOTH partners. The husband's profile often has the wedding location!
4. EXHAUSTIVE SEARCH: Read ALL provided chunks. The first chunk might be a decoy.
5. DATA CLEANUP IS MANDATORY: You are powering a genealogy cleanup app. You MUST output a <cleanup> tag at the VERY END in two scenarios: A) If relevant info is missing, suggest what to research. B) If you find rich facts in an archival document (like military service, occupations, or specific dates), suggest adding those facts to the person's main GEDCOM profile. YOU MUST INCLUDE THE EXACT EXTRACTED FACTS inside the cleanup suggestion so the user can easily copy them to Ancestry.com!
6. LIVING PEOPLE EXCEPTION: If a person was born less than 110 years ago and has an "Unknown" death date, THEY ARE ALIVE. Their death info is NOT missing, it just hasn't happened yet! Do NOT mention death records in your <cleanup> tag.
7. CURRENT DATE: Today's date is ${today}. You MUST use this to calculate current ages if asked.
8. UNLINKED ORPHANS: Documents tagged "UNLINKED ORPHAN" or "PARTIALLY LINKED" contain people found in archival documents who are NOT YET in the family tree. If asked about missing people, list them!

OUTPUT FORMAT:
1. You MUST wrap your internal reasoning in <thinking> tags (use literal < and > characters, do not escape them).
Inside the <thinking> tags, actively identify phonetic name matches, resolve maiden names, cross-reference spouses, and perform a dedicated "MARRIED NAME CHECK" for every single woman you plan to mention to ensure you use her husband's last name. Keep your thinking process brief and concise.
2. Write your polite, conversational answer to the user.
3. If ANY relevant data is missing, conflicting, or found in a raw document but not the main profile, add a <cleanup task_id="unique_topic"> tag at the VERY END. The task_id MUST be a short, unique snake_case identifier combining the person's name and the missing fact (e.g., <cleanup task_id="michael_behun_military_service">). If suggesting to add facts, YOU MUST INCLUDE THE EXACT DATA VALUES (e.g., "<cleanup task_id="michael_behun_military_service">Add Michael's military service dates...</cleanup>"). DO NOT suggest finding death records for people who are alive!

If the answer is completely missing after reasoning, say EXACTLY: "I don't know based on the family tree data."

FAMILY TREE DATA:\n${contextText}`),
        ...chatHistory.map(m => m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)),
        new HumanMessage(text),
      ]);

      const rawContent = typeof aiResponse.content === 'string' ? aiResponse.content : (Array.isArray(aiResponse.content) ? aiResponse.content.map(p => p.text || '').join('') : String(aiResponse.content));
      console.log(`💡 Raw AI Output:\n${rawContent}`);
      
      // Remove thinking block first so we don't accidentally extract <cleanup> tags from the AI's internal monologue!
      let cleanContent = rawContent.replace(/(?:<|&lt;)thinking(?:>|&gt;)[\s\S]*?(?:<|&lt;)\/thinking(?:>|&gt;)\n*/gi, '');
      
      // Remove any leftover markdown formatting blocks if the AI wrapped its entire response
      cleanContent = cleanContent.replace(/^```[a-z]*\n?/gi, '').replace(/```$/gi, '').trim();
      
      let cleanupTaskId = null;
      let cleanupText = null;
      
      const cleanupMatchWithId = cleanContent.match(/(?:<|&lt;)cleanup\s+task_id=(?:'|"|&quot;)?([^"'>&]+)(?:'|"|&quot;)?(?:>|&gt;)([\s\S]*?)(?:<|&lt;)\/cleanup(?:>|&gt;)/i);
      const cleanupMatchFallback = cleanContent.match(/(?:<|&lt;)cleanup(?:>|&gt;)([\s\S]*?)(?:<|&lt;)\/cleanup(?:>|&gt;)/i);
      
      if (cleanupMatchWithId) {
        cleanupTaskId = cleanupMatchWithId[1].trim().toLowerCase();
        cleanupText = cleanupMatchWithId[2].trim();
      } else if (cleanupMatchFallback) {
        cleanupText = cleanupMatchFallback[1].trim();
        cleanupTaskId = cleanupText.substring(0, 30).toLowerCase().replace(/[^a-z0-9]/g, '_');
      }
      
      cleanContent = cleanContent.replace(/(?:<|&lt;)cleanup[\s\S]*?(?:<|&lt;)\/cleanup(?:>|&gt;)\n*/gi, '').trim();
      
      // Convert Markdown bold to HTML bold so it renders beautifully in the Web UI
      const formattedContent = cleanContent.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
      let uiAnswer = `${formattedContent}`;
      
      if (cleanupText) {
        // Save the suggestion persistently to the SQLite database
        try {
          const existing = dbSql.prepare("SELECT id FROM cleanup_suggestions WHERE task_id = ? OR suggestion = ? LIMIT 1").get(cleanupTaskId, cleanupText);
          if (!existing) {
            const insertStmt = dbSql.prepare("INSERT INTO cleanup_suggestions (timestamp, suggestion, task_id) VALUES (?, ?, ?)");
            insertStmt.run(new Date().toISOString(), cleanupText, cleanupTaskId);
            
            // Emit the updated list back to the client immediately
            const rows = dbSql.prepare("SELECT * FROM cleanup_suggestions ORDER BY completed ASC, timestamp DESC").all();
            socket.emit("cleanups-data", rows);
          }
        } catch (e) {
          console.error("Error saving cleanup suggestion to database:", e.message);
        }
        uiAnswer += `<div class="cleanup-suggestion">🧹 <b>Cleanup Suggestion:</b> ${cleanupText}</div>`;
      }
      uiAnswer += `<div class="answer-footer">📚 <b>Sources:</b> ${topSources.replace(/\.md/g, '').replace(/_/g, ' ')}</div>`;
      
      socket.emit("answer", uiAnswer);
      
      chatHistory.push({ role: "user", content: text });
      chatHistory.push({ role: "assistant", content: cleanContent });
      if (chatHistory.length > 10) chatHistory.splice(0, chatHistory.length - 10);
    } catch (err) {
      console.error("Error during RAG pipeline:", err);
      socket.emit("answer", "Sorry, an error occurred while searching the family tree.");
    }
  });

  socket.on("disconnect", () => {
    console.log("🔴 Client disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});