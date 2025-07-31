-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Lpu" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customer" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL
);
INSERT INTO "new_Lpu" ("customer", "id", "latitude", "longitude", "name") SELECT "customer", "id", "latitude", "longitude", "name" FROM "Lpu";
DROP TABLE "Lpu";
ALTER TABLE "new_Lpu" RENAME TO "Lpu";
CREATE UNIQUE INDEX "Lpu_customer_name_key" ON "Lpu"("customer", "name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
