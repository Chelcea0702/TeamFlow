-- Optional demo data. Run via: npm run seed
-- Password for all seeded users is: password123

INSERT INTO users (id, name, email, password_hash, is_admin)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Alice Admin', 'alice@teamflow.dev', '$2b$10$B1yV1sJ8g8pQKz0kQ8x0FOeS7q3G6f1nQ2gk9fQ0M9y7t8v2wq3d.', TRUE),
  ('22222222-2222-2222-2222-222222222222', 'Bob Builder', 'bob@teamflow.dev', '$2b$10$B1yV1sJ8g8pQKz0kQ8x0FOeS7q3G6f1nQ2gk9fQ0M9y7t8v2wq3d.', FALSE),
  ('33333333-3333-3333-3333-333333333333', 'Cara Coder', 'cara@teamflow.dev', '$2b$10$B1yV1sJ8g8pQKz0kQ8x0FOeS7q3G6f1nQ2gk9fQ0M9y7t8v2wq3d.', FALSE)
ON CONFLICT (email) DO NOTHING;

INSERT INTO projects (id, name, description, created_by)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Payments Revamp', 'Rebuild of the payments service', '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

INSERT INTO project_members (project_id, user_id, role)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'owner'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-2222-2222-2222-222222222222', 'contributor'),
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '33333333-3333-3333-3333-333333333333', 'contributor')
ON CONFLICT DO NOTHING;

INSERT INTO tasks (id, project_id, title, description, status, priority, assignee_id, due_date, created_by)
VALUES
  ('bbbbbbbb-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Design new schema', 'Draft the payments schema', 'in_progress', 'high', '22222222-2222-2222-2222-222222222222', CURRENT_DATE + 3, '11111111-1111-1111-1111-111111111111'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Implement webhook handler', 'Handle provider callbacks', 'backlog', 'urgent', '33333333-3333-3333-3333-333333333333', CURRENT_DATE + 7, '11111111-1111-1111-1111-111111111111')
ON CONFLICT (id) DO NOTHING;

INSERT INTO task_relations (task_id, related_task_id, type)
VALUES ('bbbbbbbb-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000001', 'blocked_by')
ON CONFLICT DO NOTHING;

