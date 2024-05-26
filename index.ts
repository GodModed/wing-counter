import { createServer } from "http";
import express from "express";
import { Server } from "socket.io";
import { z } from "zod"

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: {
        origin: "*"
    }
});

// host socket.io client files
app.use(express.static("node_modules/socket.io/client-dist"));
// host public files
app.use(express.static("public"));

type dbUser = {
    count: number;
    name: string;
}

// io
const db = new Map<string, dbUser>();

io.on("connection", (socket) => {
    console.log("User connected");
    socket.emit("leaderboard", {
        sorted: getSorted(),
        total: getTotal()
    });

    socket.on("user", (username) => {
        if (db.has(username)) {
            // @ts-ignore
            socket.emit("amount", db.get(username).count);
        } else {
            socket.emit("amount", 0);
        }
    })

    const amountSchema = z.object({
        username: z.string().min(3).max(30),
        count: z.number().min(0)
    });

    socket.on("amount", (username: string, count: number) => {
        const data = {
            username,
            count
        };

        try {
            const parsed = amountSchema.parse(data);
            username = parsed.username;
            count = parsed.count;
        } catch (err) {
            // @ts-ignore
            socket.emit("error", err.issues[0].message);
            return;
        }

        const user = {
            count, name: username
        }
        db.set(username, user);
        io.emit("leaderboard", {
            sorted: getSorted(),
            total: getTotal()
        });
    });
});

function getSorted() {
    const sorted = Array.from(db.entries()).sort((a, b) => b[1].count - a[1].count);
    return sorted;
}

function getTotal() {
    return Array.from(db.values()).reduce((acc, user) => acc + user.count, 0);
}

httpServer.listen(3000, () => {
    console.log("Server started on http://localhost:3000");
});

function loadDB() {
    let data = {};
    try {
        data = require("./db.json");
    } catch (err) {
        console.log("No database found, creating a new one");
    }
    for (const [key, value] of Object.entries(data)) {
        // @ts-ignore
        db.set(key, value);
    }
}

function saveDB() {
    const data = Object.fromEntries(db.entries());
    require("fs").writeFileSync("./db.json", JSON.stringify(data, null, 2));
}

loadDB();
process.on("SIGINT", () => {
    saveDB();
    process.exit();
});