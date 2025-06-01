import { serve } from "@hono/node-server"
import { app, injectWebSocket } from "./src/app.js"

const server = serve(app, (info) => {
    console.log(`App running at http://localhost:${info.port}`)
})

injectWebSocket(server)

import { db } from "./src/app.js"
import { usersTable } from "./src/schema.js"
import bcrypt from "bcrypt"

const seedUser = async () => {
    const hash = await bcrypt.hash("test", 10)
    await db.insert(usersTable).values({
        name: "Tester",
        age: 25,
        bio: "Testovací uživatel",
        imageUrl: "",
        passwordHash: hash,
    })
    console.log("Testovací uživatel přidán")
}

const clearUsers = async () => {
    await db.delete(usersTable)
    console.log("Všichni uživatelé byli smazáni.")
}

const showAllUsers = async () => {
    const users = await db.select().from(usersTable).all()
    console.log("Všichni uživatelé v databázi:")
    console.table(users)
}
showAllUsers()

