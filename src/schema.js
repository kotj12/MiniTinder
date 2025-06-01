import {
    sqliteTable,
    int,
    text,
} from "drizzle-orm/sqlite-core"

// Tabulka uživatelů
export const usersTable = sqliteTable("users", {
    id: int().primaryKey({ autoIncrement: true }),
    name: text().notNull().unique(), // přidáno .unique()
    age: int().notNull(),
    bio: text().notNull(),
    imageUrl: text().notNull(),
    passwordHash: text().notNull(),
})

// Tabulka like/dislike vztahů
export const likesTable = sqliteTable("likes", {
    fromUserId: int().notNull(),
    toUserId: int().notNull(),
    liked: int({ mode: "boolean" }).notNull(), // true = like, false = dislike
})