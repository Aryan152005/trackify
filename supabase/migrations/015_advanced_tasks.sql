-- 015_advanced_tasks.sql
-- Subtasks (parent_task_id), task dependencies, and task automations

-- ---------------------------------------------------------------------------
-- 1. Subtasks: add parent_task_id to tasks
-- ---------------------------------------------------------------------------

ALTER TABLE tasks
  ADD COLUMN parent_task_id UUID REFERENCES tasks(id) ON DELETE CASCADE;

CREATE INDEX idx_tasks_parent_task_id ON tasks(parent_task_id);

-- ---------------------------------------------------------------------------
-- 2. Task dependencies
-- ---------------------------------------------------------------------------

CREATE TABLE task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL DEFAULT 'blocks', -- 'blocks', 'related'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(task_id, depends_on)
);

CREATE INDEX idx_task_dependencies_task_id ON task_dependencies(task_id);
CREATE INDEX idx_task_dependencies_depends_on ON task_dependencies(depends_on);
CREATE INDEX idx_task_dependencies_workspace ON task_dependencies(workspace_id);

-- ---------------------------------------------------------------------------
-- 3. Task automations
-- ---------------------------------------------------------------------------

CREATE TABLE task_automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_type TEXT NOT NULL, -- 'status_change', 'due_date_passed', 'assigned', 'created'
  trigger_config JSONB NOT NULL DEFAULT '{}',
  action_type TEXT NOT NULL, -- 'change_status', 'assign', 'notify', 'move_column'
  action_config JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_task_automations_workspace ON task_automations(workspace_id);
CREATE INDEX idx_task_automations_active ON task_automations(workspace_id, is_active);

-- ---------------------------------------------------------------------------
-- 4. RLS policies
-- ---------------------------------------------------------------------------

ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_dependencies_select"
  ON task_dependencies FOR SELECT
  USING (user_has_workspace_access(workspace_id, 'viewer'));

CREATE POLICY "task_dependencies_insert"
  ON task_dependencies FOR INSERT
  WITH CHECK (user_has_workspace_access(workspace_id, 'editor'));

CREATE POLICY "task_dependencies_delete"
  ON task_dependencies FOR DELETE
  USING (user_has_workspace_access(workspace_id, 'editor'));

ALTER TABLE task_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_automations_select"
  ON task_automations FOR SELECT
  USING (user_has_workspace_access(workspace_id, 'viewer'));

CREATE POLICY "task_automations_insert"
  ON task_automations FOR INSERT
  WITH CHECK (user_has_workspace_access(workspace_id, 'editor'));

CREATE POLICY "task_automations_update"
  ON task_automations FOR UPDATE
  USING (user_has_workspace_access(workspace_id, 'editor'));

CREATE POLICY "task_automations_delete"
  ON task_automations FOR DELETE
  USING (user_has_workspace_access(workspace_id, 'admin'));
