alter table public.user_devices
  drop constraint user_devices_user_id_fkey,
  add constraint user_devices_user_id_fkey
    foreign key (user_id) references public.profiles(user_id) on delete cascade;
