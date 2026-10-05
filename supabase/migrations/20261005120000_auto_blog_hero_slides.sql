-- Publishing a blog post now puts it on the home hero by itself.
-- One slide for visitors and one for members, newest first; the 5 newest
-- automatic slides per audience stay on, older ones are switched off (not deleted).
-- Un-publishing a post switches its slides off. Slides you make by hand are never touched.

create or replace function public.sync_blog_hero_slides()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_live     boolean;
  v_was_live boolean := false;
  v_desc     text;
  v_aud      boolean;
  v_first    int;
begin
  if TG_OP = 'DELETE' then
    delete from hero_slides where blog_post_id = OLD.id and ai_source_type = 'auto_blog';
    return OLD;
  end if;

  v_live := NEW.published and not NEW.is_draft and coalesce(NEW.approval_status, 'approved') = 'approved';
  if TG_OP = 'UPDATE' then
    v_was_live := OLD.published and not OLD.is_draft and coalesce(OLD.approval_status, 'approved') = 'approved';
  end if;

  if not v_live then
    if v_was_live then
      update hero_slides set published = false
       where blog_post_id = NEW.id and ai_source_type = 'auto_blog';
    end if;
    return NEW;
  end if;

  v_desc := nullif(btrim(coalesce(NEW.excerpt, '')), '');
  if v_desc is null then
    v_desc := nullif(left(btrim(regexp_replace(coalesce(NEW.content, ''), '<[^>]+>', ' ', 'g')), 160), '');
  end if;
  v_desc := coalesce(v_desc, NEW.title);

  foreach v_aud in array array[false, true] loop
    if exists (select 1 from hero_slides where blog_post_id = NEW.id and is_for_members = v_aud) then
      update hero_slides
         set title = btrim(NEW.title), description = v_desc, image_url = NEW.featured_image_url,
             link_url = '/blog/' || NEW.slug, published = true
       where blog_post_id = NEW.id and is_for_members = v_aud and ai_source_type = 'auto_blog';
    else
      select coalesce(min(display_order), 1) - 1 into v_first from hero_slides where is_for_members = v_aud;
      insert into hero_slides
        (title, description, image_url, link_url, link_text, blog_post_id, display_order,
         is_for_members, published, show_watch_live, show_reminder, is_ai_generated, ai_source_type)
      values
        (btrim(NEW.title), v_desc, NEW.featured_image_url, '/blog/' || NEW.slug, 'Read Article', NEW.id, v_first,
         v_aud, true, true, false, false, 'auto_blog');
    end if;
  end loop;

  -- keep only the 5 newest automatic slides per audience switched on
  update hero_slides set published = false
   where id in (
     select id from (
       select id, row_number() over (partition by is_for_members order by created_at desc) as rn
         from hero_slides where ai_source_type = 'auto_blog' and published
     ) t where rn > 5
   );

  return NEW;
end;
$$;

revoke all on function public.sync_blog_hero_slides() from public, anon, authenticated;

drop trigger if exists blog_posts_hero_sync on public.blog_posts;
create trigger blog_posts_hero_sync
  after insert or update of published, is_draft, approval_status, title, excerpt, featured_image_url, slug
  on public.blog_posts
  for each row execute function public.sync_blog_hero_slides();

drop trigger if exists blog_posts_hero_cleanup on public.blog_posts;
create trigger blog_posts_hero_cleanup
  after delete on public.blog_posts
  for each row execute function public.sync_blog_hero_slides();
