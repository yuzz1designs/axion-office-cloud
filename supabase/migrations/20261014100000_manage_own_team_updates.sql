create policy "authors update own team updates"
  on public.team_updates for update to authenticated
  using (author_user_id = auth.uid() and public.is_workspace_member(workspace_id))
  with check (author_user_id = auth.uid() and public.is_workspace_member(workspace_id));

create policy "authors delete own team updates"
  on public.team_updates for delete to authenticated
  using (author_user_id = auth.uid() and public.is_workspace_member(workspace_id));
