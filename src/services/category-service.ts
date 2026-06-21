import { deleteLocalCategory } from './local-settings-service';

export async function deleteCategory(id: string): Promise<void> {
  return deleteLocalCategory(id);
}
