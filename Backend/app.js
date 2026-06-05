import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import authRoute from "./routes/AuthRoute.js";
import documentRoute from "./routes/DocumentRoute.js";
import { initSocket } from "./socket/index.js";

dotenv.config();

const app = express();
app.use(
    cors({
        origin: ["https://collab-write-delta.vercel.app", "http://localhost:5173"],
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
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

// Initialize Socket.IO handlers
initSocket(io);

server.listen(PORT, () => {
    console.log("listening on PORT:", PORT);
});

app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.use("/", authRoute);
app.use("/documents", documentRoute);