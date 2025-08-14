const express = require('express');
const http = require('http');
const cors = require('cors');
const compression = require('compression');
const axios = require('axios');
const { Server } = require('socket.io');

const PORT = process.env.PORT || 5000;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const app = express();
app.use(compression()); // GZIP compression for faster responses
app.use(cors({ origin: FRONTEND_URL, methods: ["GET", "POST"] }));
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: FRONTEND_URL, methods: ["GET", "POST"] },
  transports: ["websocket"]
});

const rooms = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("Joining room", ({ roomId, name }) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        code: "// Start coding...",
        language: "javascript",
        output: "Output will appear here..."
      };
    }

    socket.emit("current-state", rooms[roomId]);
    socket.data = { username: name, roomId };

    socket.to(roomId).emit("user-joined", name);
    console.log(`${name} joined ${roomId}`);
  });

  socket.on("code-update", (newCode, roomId) => {
    if (rooms[roomId]) rooms[roomId].code = newCode;
    socket.broadcast.to(roomId).emit("code-updated", newCode); // Don't send to self
  });

  socket.on("language-changed", ({ roomId, language }) => {
    if (rooms[roomId]) rooms[roomId].language = language;
    socket.broadcast.to(roomId).emit("language-updated", language);
  });

  socket.on("run-code", async ({ roomId, code, language }) => {
    try {
      const response = await axios.post("https://emkc.org/api/v2/piston/execute", {
        language,
        version: "*",
        files: [{ name: `main.${getExtension(language)}`, content: code }]
      }, { timeout: 5000 });

      const result = {
        output: response.data.output || "No output",
        stderr: response.data.stderr || ""
      };

      io.to(roomId).emit("code-output", result);
    } catch (err) {
      io.to(roomId).emit("code-output", { output: "", stderr: "Execution failed" });
    }
  });

  socket.on("user-typing", ({ roomId, name }) => {
    socket.broadcast.to(roomId).emit("typing", { name });
  });

  socket.on("stop-typing", ({ roomId, name }) => {
    socket.broadcast.to(roomId).emit("stop-typing", { name });
  });

  socket.on("cursor-change", ({ roomId, name, position }) => {
    socket.broadcast.to(roomId).emit("cursor-change", { name, position });
  });

  socket.on("disconnect", () => {
    if (socket.data?.roomId && socket.data?.username) {
      socket.broadcast.to(socket.data.roomId).emit("left the room", socket.data.username);
      console.log(`${socket.data.username} left ${socket.data.roomId}`);
    }
  });
});

function getExtension(language) {
  const extensions = { python: "py", javascript: "js", cpp: "cpp", java: "java" };
  return extensions[language] || "txt";
}

app.get('/', (req, res) => res.send("Backend API Running..."));
app.get('/api/ping', (req, res) => res.send("pong"));

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
