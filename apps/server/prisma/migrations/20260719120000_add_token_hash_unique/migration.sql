-- DropIndex
DROP INDEX "RefreshToken_tokenHash_idx";

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
