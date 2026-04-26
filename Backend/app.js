import express from "express";
import http from "http";
import { Server } from "socket.io";
import { createServer } from "http";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import authRoute from "./routes/AuthRoute.js";

dotenv.config();

const app = express();
app.use(
    cors({
        origin: ["http://localhost:5173"],
        methods: ["GET", "POST", "PUT", "DELETE"],
        credentials: true,
    })
);
app.use(cookieParser());
app.use(express.json());

const server = createServer(app);
const PORT = process.env.PORT || 3000;
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true,
    }
});

mongoose
    .connect(process.env.MONGODB_URI)
    .then(() => console.log("MongoDB is  connected successfully"))
    .catch((err) => console.error(err));


















//IO SECTION
io.on("connection", (socket) => {
    console.log("a user connected");
    console.log("ID : " + socket.id);

    socket.on("disconnect", () => {
        console.log(socket.id + " disconnected");
    });

    socket.emit("message", {
        ops: [
            { insert: 'The Two Towers' },
            { insert: '\n', attributes: { header: 1 } },
            { insert: 'Aragorn sped on up the hill.\n' }
        ]
    }, () => {
        console.log("message sent");
    })

    socket.on("join-room", (id) => {
        socket.join(id);
    })

    socket.on("send-delta", (id, delta) => {
        console.log("delta sent");
        socket.to(id).emit("receive-delta", delta);
    })

    socket.on("rename-room", (oldId, newId) => {
        console.log(`room renamed from ${oldId} to ${newId}`);
        // Notify others in the old room
        socket.to(oldId).emit("room-renamed", newId);
        // The sender also changes rooms
        socket.leave(oldId);
        socket.join(newId);
    });

    socket.on("leave-room", (id) => {
        console.log(`socket ${socket.id} left room ${id}`);
        socket.leave(id);
    });
});









server.listen(PORT, () => {
    console.log("listening on PORT:", PORT);
});

app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.use("/", authRoute);