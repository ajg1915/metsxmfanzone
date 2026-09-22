import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trash2, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  AdminPage, AdminPageHeader, AdminSearch, AdminList, AdminListCard,
  AdminRow, AdminEmpty, AdminLoading, AdminIconButton,
} from "@/components/admin/AdminUI";

interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  profiles: {
    full_name: string | null;
    email: string | null;
  } | null;
}

export default function PostsManagement() {
  const { toast } = useToast();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("posts")
      .select(`
        *,
        profiles (
          full_name,
          email
        )
      `)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching posts:", error);
      toast({
        title: "Error",
        description: "Failed to fetch posts",
        variant: "destructive",
      });
    } else {
      setPosts(data as any || []);
    }
    setLoading(false);
  };

  const handleDeletePost = async (postId: string) => {
    try {
      const { error } = await supabase.from("posts").delete().eq("id", postId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Post deleted successfully",
      });

      fetchPosts();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const filteredPosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter((p) =>
      `${p.content} ${p.profiles?.full_name || ""} ${p.profiles?.email || ""}`.toLowerCase().includes(q)
    );
  }, [posts, search]);

  if (loading) return <AdminLoading label="Loading posts…" />;

  return (
    <AdminPage>
      <AdminPageHeader
        icon={MessageSquare}
        title="Posts Management"
        count={posts.length}
      />

      <AdminSearch value={search} onChange={setSearch} placeholder="Search post content or author…" />

      <AdminList>
        {filteredPosts.length === 0 ? (
          <AdminEmpty message="No posts yet" />
        ) : (
          filteredPosts.map((post) => (
            <AdminListCard key={post.id}>
              <AdminRow
                title={
                  <span className="flex items-center gap-1.5">
                    <Avatar className="w-5 h-5">
                      <AvatarFallback className="text-[9px]">
                        {post.profiles?.full_name?.[0] || post.profiles?.email?.[0] || "U"}
                      </AvatarFallback>
                    </Avatar>
                    {post.profiles?.full_name || post.profiles?.email || "Anonymous"}
                  </span>
                }
                meta={new Date(post.created_at).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
                })}
                actions={
                  <AdminIconButton icon={Trash2} title="Delete" tone="danger" onClick={() => handleDeletePost(post.id)} />
                }
                body={
                  <>
                    <p className="text-xs whitespace-pre-wrap line-clamp-3">{post.content}</p>
                    {post.image_url && (
                      <img
                        src={post.image_url}
                        alt="Post"
                        className="rounded-lg max-w-full h-auto max-h-48 object-cover mt-1.5"
                      />
                    )}
                  </>
                }
              />
            </AdminListCard>
          ))
        )}
      </AdminList>
    </AdminPage>
  );
}
