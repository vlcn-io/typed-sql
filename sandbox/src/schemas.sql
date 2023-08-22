CREATE TABLE
  user (
    id INTEGER PRIMARY KEY NOT NULL,
    name TEXT NOT NULL
  );

CREATE TABLE
  task (
    id INTEGER PRIMARY KEY NOT NULL,
    what TEXT NOT NULL,
    owner_id INTEGER NOT NULL,
    list_id INTEGER
  )
