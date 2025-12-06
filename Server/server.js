import express from "express";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import  ACTIONS from "./Actions.js";
import pythonRoutes from "./routes/pythonRoutes.js";
import authRoute from "./routes/authRoute.js";
import cors from "cors";
import connectDb from "./config/db.js"
import cppRoutes from "./routes/cppRoutes.js"


dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

// CORS configuration - allow all origins for development
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Log all incoming requests
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path}`);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log(`  Body:`, JSON.stringify(req.body).substring(0, 200));
  }
  next();
});

/* ---------- FIX __dirname FOR ES MODULE ---------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------- MIDDLEWARE ---------- */
app.use(express.static("build"));
app.use(express.json());
connectDb()

const userSocketMap = {};

function getAllConnectedClients(roomId, namespace) {
  return Array.from(io.of(namespace).adapter.rooms.get(roomId) || []).map(
    (socketId) => {
      return {
        socketId,
        username: userSocketMap[socketId],
      };
    }
  );
}

/* ---------- NAMESPACE HANDLER ---------- */
function setupNamespace(namespace) {
  io.of(namespace).on("connection", (socket) => {
    console.log(`🔥 Socket connected -> ${namespace}`, socket.id);

    socket.on(ACTIONS.JOIN, ({ roomId, username }) => {
      userSocketMap[socket.id] = username;
      socket.join(roomId);

      const clients = getAllConnectedClients(roomId, namespace);

      clients.forEach(({ socketId }) => {
        io.of(namespace).to(socketId).emit(ACTIONS.JOINED, {
          clients,
          username,
          socketId: socket.id,
        });
      });
    });

    socket.on(ACTIONS.CODE_CHANGE, (payload) => {
      socket.in(payload.roomId).emit(ACTIONS.CODE_CHANGE, payload);
    });

    socket.on(ACTIONS.SYNC_CODE, (payload) => {
      io.of(namespace).to(payload.socketId).emit(ACTIONS.CODE_CHANGE, payload);
    });

    socket.on("disconnecting", () => {
      const rooms = [...socket.rooms];
      rooms.forEach((roomId) => {
        socket.in(roomId).emit(ACTIONS.DISCONNECTED, {
          socketId: socket.id,
          username: userSocketMap[socket.id],
        });
      });

      delete userSocketMap[socket.id];
    });
  });
}

/* ---------- SOCKET NAMESPACES ---------- */
setupNamespace("/js");
setupNamespace("/html");
setupNamespace("/css");
setupNamespace("/py");
setupNamespace("/cpp");

/* ---------- FRONTEND FALLBACK ---------- */




app.use("/api/python", pythonRoutes);
app.use("/api/auth",authRoute)
app.use("/api/cpp",cppRoutes)

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

/* ---------- START SERVER ---------- */
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Collaboration Server Running at ${PORT}`);
  console.log(`📝 Request logging enabled`);
  console.log(`🌐 CORS enabled for all origins`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
    console.error(`   Try: lsof -ti:${PORT} | xargs kill -9`);
    console.error(`   Or change PORT in .env file`);
  } else {
    console.error('❌ Server error:', err);
  }
  process.exit(1);
});
