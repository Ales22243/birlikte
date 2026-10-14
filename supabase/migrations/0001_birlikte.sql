-- Birlikte: iki telefon arası fotoğraf eşitleme şeması.
-- Çalıştırma: Supabase paneli -> SQL Editor -> bu dosyanın tamamını yapıştır -> Run.
-- Tablo adları "birlikte_" ile başlar; aynı projedeki diğer uygulamaların tablolarına dokunmaz.

create table if not exists public.birlikte_couples (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,
  name_a      text not null,
  name_b      text not null,
  start_date  date not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.birlikte_members (
  couple_id   uuid not null references public.birlikte_couples (id) on delete cascade,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  primary key (couple_id, user_id)
);

create table if not exists public.birlikte_photos (
  id          uuid primary key,
  couple_id   uuid not null references public.birlikte_couples (id) on delete cascade,
  path        text not null,
  taken_at    date not null,
  caption     text not null default '',
  updated_at  bigint not null,
  deleted_at  bigint
);
create index if not exists birlikte_photos_couple on public.birlikte_photos (couple_id, updated_at);

-- Yardımcı: oturumdaki kullanıcı bu çiftin üyesi mi?
create or replace function public.birlikte_is_member(c uuid)
returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from public.birlikte_members m where m.couple_id = c and m.user_id = auth.uid());
$$;

-- Yeni çift oluşturur, oluşturanı üye yapar, 6 haneli eşleşme kodunu döndürür.
create or replace function public.birlikte_create_couple(a text, b text, start date)
returns table (couple_id uuid, code text)
language plpgsql security definer set search_path = public, extensions as $$
declare
  new_code text;
  new_id uuid;
begin
  if auth.uid() is null then raise exception 'giriş gerekli'; end if;
  loop
    new_code := upper(substr(translate(encode(gen_random_bytes(6), 'base64'), '+/=Il1O0', 'XYZWKMNP'), 1, 6));
    exit when not exists (select 1 from public.birlikte_couples c where c.code = new_code);
  end loop;
  insert into public.birlikte_couples (code, name_a, name_b, start_date)
    values (new_code, a, b, start) returning id into new_id;
  insert into public.birlikte_members (couple_id, user_id) values (new_id, auth.uid());
  return query select new_id, new_code;
end $$;

-- Sevgili kodu girince çifte katılır.
create or replace function public.birlikte_join_couple(join_code text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare cid uuid;
begin
  if auth.uid() is null then raise exception 'giriş gerekli'; end if;
  select id into cid from public.birlikte_couples where code = upper(trim(join_code));
  if cid is null then raise exception 'kod bulunamadı'; end if;
  insert into public.birlikte_members (couple_id, user_id) values (cid, auth.uid()) on conflict do nothing;
  return cid;
end $$;

alter table public.birlikte_couples enable row level security;
alter table public.birlikte_members enable row level security;
alter table public.birlikte_photos  enable row level security;

drop policy if exists couples_read   on public.birlikte_couples;
drop policy if exists couples_update on public.birlikte_couples;
create policy couples_read   on public.birlikte_couples for select using (public.birlikte_is_member(id));
create policy couples_update on public.birlikte_couples for update using (public.birlikte_is_member(id));

drop policy if exists members_read on public.birlikte_members;
create policy members_read on public.birlikte_members for select using (public.birlikte_is_member(couple_id));

drop policy if exists photos_all on public.birlikte_photos;
create policy photos_all on public.birlikte_photos for all
  using (public.birlikte_is_member(couple_id)) with check (public.birlikte_is_member(couple_id));

-- Fotoğraf dosyaları: özel kova; yol "<couple_id>/<photo_id>.jpg" biçimindedir.
insert into storage.buckets (id, name, public) values ('birlikte-photos', 'birlikte-photos', false)
  on conflict (id) do nothing;

drop policy if exists birlikte_files_all on storage.objects;
create policy birlikte_files_all on storage.objects for all
  using (bucket_id = 'birlikte-photos' and public.birlikte_is_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'birlikte-photos' and public.birlikte_is_member(((storage.foldername(name))[1])::uuid));
