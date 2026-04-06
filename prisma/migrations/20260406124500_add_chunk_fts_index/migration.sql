-- GIN index for full-text search on Chunk.text
CREATE INDEX "chunk_text_fts_idx" ON "Chunk" USING GIN (to_tsvector('english', "text"));
