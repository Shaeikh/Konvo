import { createServer } from "http";
import next from "next";
import { Server } from "socket.io";
import db from "./lib/db.js";
import { auth } from "./lib/auth.js";

const hostname = process.env.HOSTNAME || "localhost";
const PORT = Number(process.env.PORT || 3000);
const dev = process.env.NODE_ENV !== "production";
const onlineUsers = new Map();

const app = next({ dev, hostname, port: PORT, webpack: dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => handle(req, res));
  setupSockets(httpServer);
  httpServer.listen(PORT, hostname, () =>
    console.log(`> Next.js and Socket.IO active at http://${hostname}:${PORT}`),
  );
});

function setupSockets(httpServer: any) {
  const allowedOrigins = [
    "http://localhost:3000",
    process.env.NEXT_PUBLIC_APP_URL,
  ].filter(Boolean);

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          console.log("Blocked CORS origin:", origin);
          callback(new Error("Not allowed by CORS"));
        }
      },
      methods: ["GET", "POST"],
      credentials: true,
    },
  });
  io.engine.on("connection_error", (err) => {
    console.error("ENGINE CONNECTION ERROR");
    console.error("code:", err.code);
    console.error("message:", err.message);
    console.error("context:", err.context);
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const cookieHeader = socket.handshake.headers.cookie;

      if (!token && !cookieHeader) {
        return next(new Error("Authentication failed: No token provided"));
      }

      // Construct headers for Better Auth session validation
      const headers = new Headers();
      if (cookieHeader) headers.append("cookie", cookieHeader);
      if (token) headers.append("authorization", `Bearer ${token}`);

      const session = await auth.api.getSession({ headers });

      if (!session || !session.user) {
        return next(new Error("Authentication failed: Invalid session"));
      }

      (socket as any).user = session.user;
      next();
    } catch (error) {
      return next(new Error("Internal authentication error"));
    }
  });

  io.on("connection", (socket) => {
    const user = (socket as any).user;
    const userId = user.id; // Better Auth string ID

    if (!onlineUsers.has(userId)) {
      onlineUsers.set(userId, {
        profile: { id: userId, name: user.name || user.email },
        sockets: new Set(),
      });
    }
    onlineUsers.get(userId).sockets.add(socket.id);

    console.log(`User ${user.email} connected.`);

    socket.on("disconnect", () => {
      const userData = onlineUsers.get(userId);
      if (userData) {
        userData.sockets.delete(socket.id);

        if (userData.sockets.size === 0) {
          onlineUsers.delete(userId);
          console.log(`User ${userId} went offline.`);

          broadcastOnlineUsers();
        }
      }
    });

    socket.on("room-joined", (room, recievedUser) => {
      socket.join(room);
      if (userId === recievedUser.id) {
        broadcastOnlineUsers();
      }
    });
    function broadcastOnlineUsers() {
      const onlineUsersList = Array.from(onlineUsers.values()).map(
        (userGroup) => userGroup.profile,
      );
      io.emit("online-users-list", onlineUsersList);
    }

    socket.on("typing", (data) => {
      // console.log("SERVER GOT typing", data);
      // console.log("ROOM:", data.roomID);
      // console.log("ROOM MEMBERS:", io.sockets.adapter.rooms.get(data.roomID));

      socket.to(data.roomID).emit("user-typing", data);
    });

    socket.on("send-message", async (message) => {
      try {
        await db.query(
          `
      INSERT INTO messages (
        id,
        user_id,
        room,
        type,
        content,
        created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
          [
            message.id,
            message.user.id,
            message.room,
            message.type,
            message.content,
            message.createdAt,
          ],
        );

        io.to(message.room).emit("receive-message", message);
      } catch (err) {
        console.error("MESSAGE ERROR:", err);
      }
    });

    socket.on("message-delete", async (user, message) => {
      if (!user || !message || user.id !== message.user.id) return;

      try {
        console.log("deleted message");

        await db.query("DELETE FROM messages WHERE id = $1", [message.id]);
      } catch (err) {
        console.error("MESSAGE DELETE ERROR:", err);
      }
    });
  });
}
