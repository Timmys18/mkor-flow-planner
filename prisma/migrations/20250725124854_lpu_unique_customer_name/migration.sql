/*
  Warnings:

  - A unique constraint covering the columns `[customer,name]` on the table `Lpu` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Lpu_customer_name_key" ON "Lpu"("customer", "name");
