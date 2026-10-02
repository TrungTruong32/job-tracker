-- CV documents built from the profile (see lib/cv/resolve.ts for `content`).

create table public.cv_documents (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  name text not null check (length(trim(name)) > 0),
  template text not null default 'mine' check (template in ('mine', 'classic', 'harvard', 'modern', 'compact', 'sidebar')),
  target_role text,
  target_tags text[] not null default '{}',
  style jsonb not null default '{}'::jsonb check (jsonb_typeof(style) = 'object'),
  content jsonb not null default '{"sections": []}'::jsonb check (jsonb_typeof(content) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, workspace_id)
);
create index cv_documents_ws_idx on public.cv_documents (workspace_id, updated_at desc);

create trigger cv_documents_updated before update on public.cv_documents
  for each row execute function public.set_updated_at();
create trigger cv_documents_ws_immutable before update of workspace_id on public.cv_documents
  for each row execute function public.workspace_id_immutable();

alter table public.cv_documents enable row level security;
create policy "member_select" on public.cv_documents for select to authenticated using (public.is_member(workspace_id));
create policy "member_insert" on public.cv_documents for insert to authenticated with check (public.is_member(workspace_id));
create policy "member_update" on public.cv_documents for update to authenticated
  using (public.is_member(workspace_id)) with check (public.is_member(workspace_id));
create policy "member_delete" on public.cv_documents for delete to authenticated using (public.is_member(workspace_id));

-- a saved CV version can remember which document produced it (same workspace only)
alter table public.cv_versions add column document_id uuid;
alter table public.cv_versions
  add constraint cv_versions_document_fk foreign key (document_id, workspace_id)
  references public.cv_documents (id, workspace_id) on delete set null (document_id);
