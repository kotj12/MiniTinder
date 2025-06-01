import { eq, and } from "drizzle-orm"
import { usersTable, likesTable } from "./schema.js"
import { not, sql } from "drizzle-orm"

// Vloží nového uživatele
export const insertUser = async (db, { name, age, bio, imageUrl, passwordHash }) => {
    await db.insert(usersTable).values({ name, age, bio, imageUrl, passwordHash })
}

// Najde jednoho náhodného uživatele, kterého current user ještě nehodnotil
export const getUnratedUser = async (db, currentUserId) => {
    const subQuery = db
        .select({ toUserId: likesTable.toUserId })
        .from(likesTable)
        .where(eq(likesTable.fromUserId, currentUserId))

    const users = await db
        .select()
        .from(usersTable)
        .where(and(
            not(eq(usersTable.id, String(currentUserId))),
            sql`${usersTable.id} NOT IN (${subQuery})`
        ))
        .all()

    return users.length > 0
        ? users[Math.floor(Math.random() * users.length)]
        : null
}

// Uloží like nebo dislike
export const likeUser = async (db, fromUserId, toUserId, liked) => {
    const existing = await db
        .select()
        .from(likesTable)
        .where(and(
            eq(likesTable.fromUserId, fromUserId),
            eq(likesTable.toUserId, toUserId)
        ))
        .get()

    if (!existing) {
        await db.insert(likesTable).values({ fromUserId, toUserId, liked })
    }
}

// Získá info o uživateli
export const getUserById = async (db, id) => {
    return await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, id))
        .get()
}

// Vrátí všechny uživatele, se kterými mám match (vzájemný like)
export const getMatches = async (db, currentUserId) => {
    const matches = await db
        .select({ user: usersTable })
        .from(usersTable)
        .innerJoin(likesTable, eq(usersTable.id, likesTable.toUserId))
        .where(and(
            eq(likesTable.fromUserId, currentUserId),
            eq(likesTable.liked, true),
            sql`EXISTS (
        SELECT 1 FROM likes
        WHERE likes.fromUserId = ${usersTable.id}
        AND likes.toUserId = ${currentUserId}
        AND likes.liked = 1
      )`
        ))
        .all()

    return matches.map((row) => row.user)
}

export const updateUserById = async (db, id, { name, age, bio, imageUrl }) => {
    await db
        .update(usersTable)
        .set({ name, age, bio, imageUrl })
        .where(eq(usersTable.id, id))
}