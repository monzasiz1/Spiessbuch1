require("dotenv").config();
const express = require("express");
const session = require("express-session");
const path = require("path");
const bcrypt = require("bcryptjs");
const db = require("./db");
const expressLayouts = require("express-ejs-layouts");

const app = express();

// Middleware & Layouts
app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(session({
    secret: "spiessbuch-secret",
    resave: false,
    saveUninitialized: false
}));

// EJS + Layout
app.set("view engine", "ejs");
app.use(expressLayouts);
app.set("layout", "layout");
app.set("views", path.join(__dirname, "views"));


const ensureAuthenticated = (req, res, next) => {
    if (req.session.user) return next();
    res.redirect("/login");
};

const ensureAdmin = (req, res, next) => {
    if (req.session.user?.role === "admin") return next();
    res.redirect("/dashboard");
};

async function createTablesAndAdmin() {
    await db.query(`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL
    )`);
    const result = await db.query("SELECT COUNT(*) FROM users WHERE role = $1", ["admin"]);
    if (result.rows[0].count === "0") {
        const hash = await bcrypt.hash("admin123", 10);
        await db.query("INSERT INTO users (username, password, role) VALUES ($1, $2, $3)", ["admin", hash, "admin"]);
        console.log("✅ Admin angelegt: admin / admin123");
    }
}
createTablesAndAdmin();

app.get("/", (req, res) => res.redirect("/login"));

app.get("/login", (req, res) => res.render("login"));
app.post("/login", async (req, res) => {
    const { username, password } = req.body;
    const result = await db.query("SELECT * FROM users WHERE username = $1", [username]);
    if (result.rows.length === 0) return res.redirect("/login");
    const user = result.rows[0];
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.redirect("/login");
    req.session.user = user;
    res.redirect("/dashboard");
});

app.get("/register", ensureAdmin, (req, res) => res.render("register"));
app.post("/register", ensureAdmin, async (req, res) => {
    const { username, password, role } = req.body;
    const hash = await bcrypt.hash(password, 10);
    await db.query("INSERT INTO users (username, password, role) VALUES ($1, $2, $3)", [username, hash, role]);
    res.redirect("/dashboard");
});

app.get("/dashboard", ensureAuthenticated, (req, res) => {
    res.render("dashboard", { user: req.session.user });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`🚀 Server läuft auf http://localhost:${PORT}`));
