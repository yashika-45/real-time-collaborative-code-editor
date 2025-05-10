const express = require('express');
const http = require('http');
const cors = require('cors');
const axios = require('axios');
const { Server } = require('socket.io');

const app = express();
app.use(cors());
app.use(express.json());
const corsOptions = {
  origin: "http://localhost:3000",
  methods: ["GET", "POST"],
};

app.use(cors(corsOptions));
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const rooms = {};

io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);
  socket.on("Joining room",({roomId,name}) => {
    socket.join(roomId);
    if(!rooms[roomId]){
      rooms[roomId]={
        code: "//Start coding...",
        language:'javascript',
        output:'Output will appear here...',
      };
    }
    socket.emit("current-state", rooms[roomId]);
    socket.data.username=name;
    socket.data.roomId=roomId;
    io.to(roomId).emit("user-joined", name);
    console.log(`${name} joined room ${roomId}`);
    socket.on("disconnect", () => {
      console.log(`${name} left room ${roomId}`);
      io.to(roomId).emit("left the room", name);
    });
  });
  socket.on("send-message", (message) => {
    console.log("Message from user:", message);
    io.emit("message", message);
  });
  socket.on("code-update",(newCode,roomId) => {
    if (rooms[roomId]) {
    rooms[roomId].code = newCode;
  }
    console.log(`code updated in room ${roomId}`);
    io.to(roomId).emit("code-updated", newCode);
  });
  socket.on("room-created",({roomId,name})=>{
    io.to(roomId).emit("room-created-message", name);
  });
  socket.on("language-changed", ({roomId,language}) => {
    console.log(`language changed in ${roomId} to ${language}`);
    io.to(roomId).emit("language-updated", language);
  });
  socket.on("leave-room", ({ roomId, name }) => {
    socket.leave(roomId);
    console.log(`${name} left room ${roomId} (manual leave)`);
    io.to(roomId).emit("left the room", name);
  });
  socket.on("user-typing", ({roomId,name}) => {
    socket.to(roomId).emit("typing", {name});
  });
  socket.on("stop-typing", ({roomId,name}) => {
    socket.to(roomId).emit("stop-typing", {name});
  });
  socket.on("cursor-change", ({roomId,name,position})=>{
    socket.to(roomId).emit("cursor-change", {name,position});
  });
  socket.on("run-code", ({roomId,code,language})=>{
    socket.to(roomId).emit("run-code", {code,language});
  });
});
app.get('/', (req, res) => {
    res.send("Backend API Running...");
  });
  
  app.get('/api/ping', (req, res) => {
    res.send("pong");
  });
  
  function getExtension(language) {
    const extensions = {
      python: "py",
      javascript: "js",
      cpp: "cpp",
      java: "java"
      // add more as needed
    };
    return extensions[language] || "txt";
  }

  app.post('/run', async (req, res) => {
    const { language, code } = req.body;
  
    if (!language || !code) {
      return res.status(400).json({ error: 'Language and code are required.' });
    }
  
    try {
      const response = await axios.post("https://emkc.org/api/v2/piston/execute", {
        language,
        version: "*", // use latest version
        files: [
          {
            name: "main." + getExtension(language),
            content: code
          }
        ]
      });
      res.json({
        output: response.data.output || "No output",
        stderr: response.data.stderr || "No error output",
      });
      console.log(response);
    } catch (err) {
      console.error("Code execution error:");
      if (err.response) {
        console.error("Status:", err.response.status);
        console.error("Data:", err.response.data);
      } else {
        console.error(err.message);
      }
  
      res.status(500).json({ error: "Failed to execute code." });
    }
  });
  
  
  
server.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});
