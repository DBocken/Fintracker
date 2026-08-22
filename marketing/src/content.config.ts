import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/*
 * Blog-Artikel liegen als Markdown im Git — dieselbe Versionierung wie der
 * Code. Decap CMS (public/admin) schreibt in genau dieses Verzeichnis, ohne
 * Datenbank und ohne zweiten Anbieter dazwischen.
 *
 * Das Schema ist Absicht: ein fehlendes `beschreibung` bricht den Build,
 * statt eine Seite ohne Meta-Description zu veroeffentlichen. Genau die
 * faellt in generativer Suche durch.
 */
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    titel: z.string(),
    beschreibung: z.string().min(50, 'Zu kurz für eine brauchbare Meta-Description.'),
    datum: z.coerce.date(),
    aktualisiert: z.coerce.date().optional(),
    autor: z.string().default('Fintracker'),
    entwurf: z.boolean().default(false),
  }),
});

export const collections = { blog };
