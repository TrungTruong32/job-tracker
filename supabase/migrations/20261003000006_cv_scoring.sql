-- Part C: the JD a CV document is scored against, and the cached AI keyword extraction.
alter table public.cv_documents
  add column target_application_id uuid,
  add column target_jd text check (target_jd is null or length(target_jd) <= 30000),
  add column jd_keywords jsonb check (jd_keywords is null or jsonb_typeof(jd_keywords) = 'object');

alter table public.cv_documents
  add constraint cv_documents_target_application_fk foreign key (target_application_id, workspace_id)
  references public.applications (id, workspace_id) on delete set null (target_application_id);
