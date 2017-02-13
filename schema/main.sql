CREATE TABLE IF NOT EXISTS "window-states" (
    "window_id" TEXT PRIMARY KEY,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "loc_x" INTEGER NOT NULL,
    "loc_y" INTEGER NOT NULL
) WITHOUT ROWID;