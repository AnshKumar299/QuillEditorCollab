import express from "express";
import http from "http";
import { Server } from "socket.io";
import { createServer } from "http";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import authRoute from "./routes/AuthRoute.js";
import documentRoute from "./routes/DocumentRoute.js";
import Document from "./models/Document.js";

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
        if (socket.currentRoom) {
            socket.to(socket.currentRoom).emit("user-left", socket.username || socket.id);
        }
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

    socket.on("join-room", async (id, username) => {
        if (socket.currentRoom && socket.currentRoom !== id) {
            socket.to(socket.currentRoom).emit("user-left", socket.username || socket.id);
            socket.leave(socket.currentRoom);
        }
        socket.currentRoom = id;
        socket.username = username;
        socket.join(id);
        io.to(id).emit("user-joined", username || socket.id);

        try {
            const document = await Document.findById(id);
            if (document) {
                socket.emit("load-document", { 
                    content: document.content, 
                    title: document.title 
                });
            }
        } catch (err) {
            console.error("Error loading document on join:", err);
        }
    })

    socket.on("save-document", async (id, content) => {
        try {
            await Document.findByIdAndUpdate(id, { content });
        } catch (err) {
            console.error("Error saving document:", err);
        }
    });

    socket.on("rename-document", async (id, title) => {
        try {
            await Document.findByIdAndUpdate(id, { title });
            
            // Send to others in the document room
            socket.to(id).emit("document-renamed", socket.username || socket.id, title);
            
            // If the user is in a custom collab room, send to others there too
            if (socket.currentRoom && socket.currentRoom !== id) {
                socket.to(socket.currentRoom).emit("document-renamed", socket.username || socket.id, title);
            }
            
            // Explicitly send back to the user who renamed it so their log updates
            socket.emit("document-renamed", socket.username || socket.id, title);
            
        } catch (err) {
            console.error("Error renaming document:", err);
        }
    });

    socket.on("send-delta", (id, delta) => {
        socket.to(id).emit("receive-delta", delta);
    })

    socket.on("chat-message", (id, username, message) => {
        socket.to(id).emit("receive-chat-message", username, message);
    });



    socket.on("leave-room", (id, username) => {
        console.log(`socket ${socket.id} left room ${id}`);
        socket.to(id).emit("user-left", username || socket.id);
        socket.leave(id);
        socket.currentRoom = null;
    });
});









server.listen(PORT, () => {
    console.log("listening on PORT:", PORT);
});

app.get("/", (req, res) => {
    res.send("Hello World!");
});

app.use("/", authRoute);
app.use("/documents", documentRoute);