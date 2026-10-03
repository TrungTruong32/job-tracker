-- "harvard" now renders the sample-cv layout; the old serif Harvard look is "serif".
alter table public.cv_documents drop constraint if exists cv_documents_template_check;
alter table public.cv_documents add constraint cv_documents_template_check
  check (template in ('mine', 'classic', 'harvard', 'serif', 'modern', 'compact', 'sidebar'));
