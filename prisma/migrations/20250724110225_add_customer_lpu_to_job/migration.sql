-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MkorJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "start" DATETIME NOT NULL,
    "customer" TEXT,
    "lpu" TEXT,
    "mkorUnitId" TEXT NOT NULL,
    CONSTRAINT "MkorJob_mkorUnitId_fkey" FOREIGN KEY ("mkorUnitId") REFERENCES "MkorUnit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MkorJob" ("id", "mkorUnitId", "start") SELECT "id", "mkorUnitId", "start" FROM "MkorJob";
DROP TABLE "MkorJob";
ALTER TABLE "new_MkorJob" RENAME TO "MkorJob";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
