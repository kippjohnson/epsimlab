CREATE TABLE learning_progress (
 user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
 module_id TEXT NOT NULL,
 version INTEGER NOT NULL,
 answers TEXT NOT NULL,
 updated_at INTEGER NOT NULL,
 PRIMARY KEY (user_id, module_id)
);
