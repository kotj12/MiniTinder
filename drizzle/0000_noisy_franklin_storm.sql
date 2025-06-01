CREATE TABLE `likes` (
	`fromUserId` integer NOT NULL,
	`toUserId` integer NOT NULL,
	`liked` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`age` integer NOT NULL,
	`bio` text NOT NULL,
	`imageUrl` text NOT NULL,
	`passwordHash` text NOT NULL
);
