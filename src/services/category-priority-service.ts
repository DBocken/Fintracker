import { supabase } from "@/integrations/supabase/client";

export interface UserCategoryPriority {
  category_id: string;
  priority: number;
}

export async function getUserCategoryPriorities(userId: string): Promise<UserCategoryPriority[]> {
  const { data, error } = await supabase
    .from("user_category_priorities")
    .select("category_id, priority")
    .eq("user_id", userId);

  if (error) throw error;
  return data ?? [];
}

export async function upsertUserCategoryPriorities(userId: string, items: UserCategoryPriority[]): Promise<void> {
  if (!items.length) return;
  const rows = items.map(i => ({
    user_id: userId,
    category_id: i.category_id,
    priority: i.priority,
  }));

  const { error } = await supabase
    .from("user_category_priorities")
    .upsert(rows, { onConflict: "user_id,category_id" });

  if (error) throw error;
}