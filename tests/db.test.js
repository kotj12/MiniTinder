import test from "ava"
import fs from "fs"
import { createClient } from "@libsql/client"
import { drizzle } from "drizzle-orm/libsql"
import { sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/libsql/migrator"
import { usersTable, likesTable } from "../src/schema.js"
import {
    insertUser,
    getUnratedUser,
    likeUser,
    getUserById,
    getMatches,
    updateUserById,
} from "../src/db.js"

if (!fs.existsSync("test.db")) {
    fs.writeFileSync("test.db", "")
}

const client = createClient({
    url: "file:test.db",
})
export const testDb = drizzle(client)

test.before("run migrations", async () => {
    await migrate(testDb, { migrationsFolder: "drizzle" })
})

test.beforeEach(async () => {
    await testDb.delete(likesTable)
    await testDb.delete(usersTable)
})

test.serial("insertUser inserts a new user", async (t) => {
    await insertUser(testDb, {
        name: "TestUser",
        age: 22,
        bio: "Testing...",
        imageUrl: "https://test.com/image.jpg",
        passwordHash: "testhash",
    })

    const user = await testDb.select().from(usersTable).where().get()
    t.truthy(user)
    t.is(user.name, "TestUser")
})

test.serial("getUserById returns correct user", async (t) => {
    await insertUser(testDb, { name: "Lookup", age: 30, bio: "bio", imageUrl: "", passwordHash: "hash" })

    const inserted = await testDb.select().from(usersTable).where().get()
    const user = await getUserById(testDb, inserted.id)

    t.truthy(user)
    t.is(user.name, "Lookup")
})

test.serial("updateUserById updates user info", async (t) => {
    await insertUser(testDb, { name: "OldName", age: 18, bio: "Old bio", imageUrl: "", passwordHash: "hash" })
    const user = await testDb.select().from(usersTable).where().get()

    await updateUserById(testDb, user.id, {
        name: "NewName",
        age: 99,
        bio: "Updated bio",
        imageUrl: "https://updated.com/image.jpg",
    })

    const updated = await getUserById(testDb, user.id)
    t.is(updated.name, "NewName")
    t.is(updated.age, 99)
    t.is(updated.bio, "Updated bio")
    t.is(updated.imageUrl, "https://updated.com/image.jpg")
})

test.serial("getUnratedUser returns an unrated user", async (t) => {
    await insertUser(testDb, { name: "User1", age: 25, bio: "", imageUrl: "", passwordHash: "hash" })
    await insertUser(testDb, { name: "User2", age: 26, bio: "", imageUrl: "", passwordHash: "hash" })
    await insertUser(testDb, { name: "CurrentUser", age: 27, bio: "", imageUrl: "", passwordHash: "hash" })

    const currentUser = await testDb
        .select()
        .from(usersTable)
        .where(sql`${usersTable.name} = 'CurrentUser'`)
        .get()

    const unrated = await getUnratedUser(testDb, currentUser.id)
    t.truthy(unrated)
    t.not(unrated.id, currentUser.id)
})

test.serial("likeUser inserts a like and prevents duplicates", async (t) => {
    await insertUser(testDb, { name: "A", age: 20, bio: "", imageUrl: "", passwordHash: "hash" })
    await insertUser(testDb, { name: "B", age: 21, bio: "", imageUrl: "", passwordHash: "hash" })

    const a = await testDb.select().from(usersTable).where(sql`${usersTable.name} = 'A'`).get()
    const b = await testDb.select().from(usersTable).where(sql`${usersTable.name} = 'B'`).get()

    await likeUser(testDb, a.id, b.id, true)
    await likeUser(testDb, a.id, b.id, true)

    const likes = await testDb.select().from(likesTable).all()
    t.is(likes.length, 1)
})

test.serial("getMatches returns mutual likes", async (t) => {
    await insertUser(testDb, { name: "A", age: 20, bio: "", imageUrl: "", passwordHash: "hash" })
    await insertUser(testDb, { name: "B", age: 21, bio: "", imageUrl: "", passwordHash: "hash" })

    const a = await testDb.select().from(usersTable).where(sql`${usersTable.name} = 'A'`).get()
    const b = await testDb.select().from(usersTable).where(sql`${usersTable.name} = 'B'`).get()

    await likeUser(testDb, a.id, b.id, true)
    await likeUser(testDb, b.id, a.id, true)

    const matches = await getMatches(testDb, a.id)
    t.is(matches.length, 1)
    t.is(matches[0].id, b.id)
})

test.after.always(() => {
    client.close()
})