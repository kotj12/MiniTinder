import { Hono } from "hono"
import { logger } from "hono/logger"
import { serveStatic } from "@hono/node-server/serve-static"
import { drizzle } from "drizzle-orm/libsql"
import { createNodeWebSocket } from "@hono/node-ws"
import bcrypt from "bcrypt"
import { eq } from "drizzle-orm"
import { usersTable, likesTable } from "./schema.js"
import fs from "fs/promises"
import fsSync from "fs"
import {
    getUserById,
    getUnratedUser,
    likeUser,
    getMatches,
    updateUserById
} from "./db.js"
import path from "path"
import { renderFile } from "ejs"

// Inicializace databáze
export const db = drizzle({
    connection: "file:db.sqlite",
    logger: true,
})

// Inicializace appky
export const app = new Hono()

// WebSocket integrace
export const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })

// Middleware
app.use(logger())
app.use(serveStatic({ root: "public" }))

// Middleware pro simulaci přihlášení (pouze pro dynamické stránky)
app.use("*", async (c, next) => {
    const path = c.req.path

    if (
        path.startsWith("/auth") ||
        path.startsWith("/styles") ||
        path.startsWith("/uploads") ||
        path.startsWith("/favicon.ico") ||
        path.startsWith("/apple-touch-icon") ||
        path.startsWith("/ws")
    ) {
        return await next()
    }

    const id = Number(c.req.query("user"))
    if (!id) return c.redirect("/auth/login")

    const user = await getUserById(db, id)
    if (!user) return c.redirect("/auth/login")

    c.set("currentUser", user)
    await next()
})

// login form
app.get("/auth/login", async (c) => {
    const error = c.req.query("error")
    const html = await renderFile("views/login.html", { error })
    return c.html(html)
})

// handle login
app.post("/auth/login", async (c) => {
    const form = await c.req.formData()
    const name = form.get("name")
    const password = form.get("password")

    const user = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.name, name))
        .get()

    if (!user) return c.redirect("/auth/login?error=notfound")

    const match = await bcrypt.compare(password, user.passwordHash)
    if (!match) return c.redirect("/auth/login?error=invalid")

    return c.redirect(`/?user=${user.id}`)
})

// register form
app.get("/auth/register", async (c) => {
    const html = await renderFile("views/register.html", {})
    return c.html(html)
})

// handle registration
app.post("/auth/register", async (c) => {
    const form = await c.req.formData()
    const name = form.get("name")
    const password = form.get("password")
    const age = Number(form.get("age"))
    const bio = form.get("bio")
    const image = form.get("image")

    if (!name || !password || !age || !bio || !(image instanceof File)) {
        return c.text("Chybí povinná pole nebo obrázek", 400)
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const existing = await db.select().from(usersTable).where(eq(usersTable.name, name)).get()
    if (existing) return c.text("Uživatel už existuje", 400)

    const result = await db.insert(usersTable).values({
        name,
        age,
        bio,
        imageUrl: "",
        passwordHash,
    }).returning({ id: usersTable.id })

    const userId = result[0].id

    // Pošli obrázek na Express upload server
    const uploadForm = new FormData()
    uploadForm.append("image", image)
    uploadForm.append("userId", userId)

    const uploadRes = await fetch("http://localhost:4000/upload", {
        method: "POST",
        body: uploadForm,
    })

    if (!uploadRes.ok) return c.text("Chyba při uploadu obrázku", 500)

    const { imageUrl } = await uploadRes.json()

    await db.update(usersTable)
        .set({ imageUrl })
        .where(eq(usersTable.id, userId))

    return c.redirect(`/?user=${userId}`)
})

app.get("/", async (c) => {
    const currentUser = c.get("currentUser")

    const targetUser = await getUnratedUser(db, currentUser.id)

    const html = await renderFile("views/index.html", {
        currentUser,
        targetUser,
    })

    return c.html(html)
})

app.post("/like/:id", async (c) => {
    const currentUser = c.get("currentUser")
    const targetId = Number(c.req.param("id"))

    await likeUser(db, currentUser.id, targetId, true)
    await sendUsersUpdateToAllConnections()
    return c.redirect(`/?user=${currentUser.id}`)
})

app.post("/dislike/:id", async (c) => {
    const currentUser = c.get("currentUser")
    const targetId = Number(c.req.param("id"))

    await likeUser(db, currentUser.id, targetId, false)
    await sendUsersUpdateToAllConnections()
    return c.redirect(`/?user=${currentUser.id}`)
})

app.get("/profile", async (c) => {
    const user = c.get("currentUser")

    const html = await renderFile("views/profile.html", {
        user,
    })

    return c.html(html)
})

app.get("/matches", async (c) => {
    const user = c.get("currentUser")
    const matches = await getMatches(db, user.id)

    const html = await renderFile("views/matches.html", {
        user,
        matches,
    })

    return c.html(html)
})

app.post("/auth/logout", async (c) => {
    return c.redirect("/auth/login")
})

app.get("/profile/edit", async (c) => {
    const user = c.get("currentUser")

    const html = await renderFile("views/profile-edit.html", {
        user,
    })

    return c.html(html)
})

app.post("/profile/edit", async (c) => {
    const user = c.get("currentUser")
    const form = await c.req.formData()

    const name = form.get("name")
    const age = Number(form.get("age"))
    const bio = form.get("bio")
    const image = form.get("image")

    let imageUrl = user.imageUrl

    // Pokud byl opravdu nahrán nový obrázek
    if (image instanceof File && image.name) {
        //  Starý obrázek (pokud není placeholder)
        if (!user.imageUrl.startsWith("https://via.placeholder.com")) {
            const oldPath = path.join("public", user.imageUrl)
            try {
                await fs.unlink(oldPath)
                console.log("Starý obrázek smazán:", oldPath)
            } catch (err) {
                console.warn("Obrázek nešel smazat:", err.message)
            }
        }

        // Upload na Express server
        const uploadForm = new FormData()
        uploadForm.set("image", image)
        uploadForm.set("userId", user.id)

        const res = await fetch("http://localhost:4000/upload", {
            method: "POST",
            body: uploadForm,
        })

        let result
        try {
            result = await res.json()
        } catch (err) {
            const text = await res.text()
            console.warn("Upload server neposlal JSON:", text)
            return c.text("Chyba při zpracování odpovědi z upload serveru", 500)
        }

        if (!res.ok || !result.imageUrl) {
            return c.text("Nahrání obrázku selhalo", 500)
        }

        imageUrl = result.imageUrl
    }

    // Aktualizace údajů
    await updateUserById(db, Number(user.id), {
        name,
        age,
        bio,
        imageUrl,
    })
    await sendUserDetailToAllConnections(user.id)
    return c.redirect(`/profile?user=${user.id}`)
})

app.post("/profile/delete", async (c) => {
    const user = c.get("currentUser")

    // Smazání všech like vztahů
    await db.delete(likesTable).where(eq(likesTable.fromUserId, user.id))
    await db.delete(likesTable).where(eq(likesTable.toUserId, user.id))

    // Smazání souboru s obrázkem
    const imagePath = path.join("public", user.imageUrl)
    try {
        await fs.unlink(imagePath)
        console.log(`🗑️ Smazán obrázek: ${imagePath}`)
    } catch (err) {
        console.warn(`Nelze smazat obrázek: ${imagePath} (${err.message})`)
    }

    // Smazání samotného uživatele
    await db.delete(usersTable).where(eq(usersTable.id, user.id))
    await sendUsersUpdateToAllConnections()
    return c.redirect("/auth/login")
})

/** @type{Set<WSContext<WebSocket>>} */
const connections = new Set()

app.get(
    "/ws",
    upgradeWebSocket((c) => {
        console.log("WebSocket připojen")

        return {
            onOpen: (ev, ws) => {
                connections.add(ws)
                console.log("Připojení otevřeno")
            },
            onClose: (evt, ws) => {
                connections.delete(ws)
                console.log("Připojení zavřeno")
            },
            onMessage: (evt, ws) => {
                console.log("Zpráva:", evt.data)
            },
        }
    })
)

const sendUsersUpdateToAllConnections = async () => {
    const users = await db.select().from(usersTable).all();

    const data = JSON.stringify({
        type: "users-update",
        users: users.map(u => ({
            id: u.id,
            name: u.name,
            age: u.age,
            bio: u.bio,
            imageUrl: u.imageUrl
        }))
    });

    for (const connection of connections.values()) {
        connection.send(data);
    }
};

const sendUserDetailToAllConnections = async (id) => {
    const user = await getUserById(db, id)

    const data = JSON.stringify({
        type: "users-update",
        user: {
            id: user.id,
            name: user.name,
            age: user.age,
            bio: user.bio,
            imageUrl: user.imageUrl
        }
    })

    for (const connection of connections.values()) {
        connection.send(data)
    }
}