-- CreateTable
CREATE TABLE "MkorUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "diameter" INTEGER NOT NULL,
    "availableFrom" DATETIME NOT NULL,
    "segments" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "MkorJob" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "start" DATETIME NOT NULL,
    "mkorUnitId" TEXT NOT NULL,
    CONSTRAINT "MkorJob_mkorUnitId_fkey" FOREIGN KEY ("mkorUnitId") REFERENCES "MkorUnit" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MkorInventory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "diameter" INTEGER NOT NULL,
    "count" INTEGER NOT NULL,
    "availableFrom" DATETIME NOT NULL
);
