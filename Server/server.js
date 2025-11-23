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

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

app.use(cors());

/* ---------- FIX __dirname FOR ES MODULE ---------- */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* ---------- MIDDLEWARE ---------- */
app.use(express.static("build"));
app.use(express.json());


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

/* ---------- FRONTEND FALLBACK ---------- */




app.use("/api/python", pythonRoutes);
app.use("/api/auth",authRoute)

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "build", "index.html"));
});

/* ---------- START SERVER ---------- */
server.listen(5000, () => {
  console.log(`🚀 Collaboration Server Running at 5000`);
});
