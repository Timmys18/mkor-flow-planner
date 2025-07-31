-- CreateTable
CREATE TABLE "TransportSupply" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "tractors" INTEGER NOT NULL,
    "trailers" INTEGER NOT NULL,
    "lowLoaders" INTEGER NOT NULL
);
