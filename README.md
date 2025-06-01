Pro spuštění appky:
npm install
npm run dev

Pro spuštění testů:
npm run test

Základní popis: 
Jednoduchá webová aplikace inspirovaná Tinderem. Každý uživatel se může zaregistrovat, vytvořit si profil a hodnotit profily ostatních. Když si dva uživatelé navzájem dají like, vznikne z toho match.

Hlavní funkce:
Registrace a přihlášení uživatele
Nahrání profilového obrázku (přes Express server)
Zobrazení náhodného nehodnoceného uživatele
Like a dislike ostatních uživatelů
Zobrazení všech svých matchů
Úprava a mazání profilu

Technologie:
Hono – webový server
Drizzle ORM – práce s databází (SQLite)
bcrypt – hashování hesel
Express – server pro nahrávání obrázků
EJS – renderování HTML šablon
