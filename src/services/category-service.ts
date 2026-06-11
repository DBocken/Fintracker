import { supabase } from '../integrations/supabase/client';
import { requireUserId } from './auth-service';

export async function deleteCategory(id: string): Promise<void> {
  const userId = await requireUserId();

  // Zuerst direkte Kinder löschen (FK vermeiden), dann die Kategorie selbst
  const { error: childError } = await supabase
    .from('categories')
    .delete()
    .eq('parent_id', id)
    .eq('user_id', userId);

  if (childError) throw new Error(childError.message);

  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}