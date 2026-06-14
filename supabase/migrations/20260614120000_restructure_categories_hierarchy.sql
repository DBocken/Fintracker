-- Strukturiert die globalen Standardkategorien (user_id IS NULL) zu einer
-- Haupt-/Unterkategorie-Hierarchie um, verteilt die Keywords auf die
-- Unterkategorien und setzt das `essenziell`-Flag (existenzsichernd).
-- Generiert aus src/data/merchant-keywords.ts via
-- scripts/generate-category-migration.mjs. Idempotent (NOT EXISTS + Updates).

-- 1) Umbenennungen bestehender Hauptkategorien
UPDATE categories SET name = 'Essen & Trinken' WHERE user_id IS NULL AND name = 'Restaurant & Café' AND NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Essen & Trinken');

-- 💶 Einkommen
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Einkommen', '#2e7d72', '💶', '[]'::jsonb, true, NULL, '{"essenziell":false,"ausgabenklasse":"einkommen"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Einkommen');
UPDATE categories SET color = '#2e7d72', icon = '💶', filters = '[]'::jsonb, attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"einkommen"}'::jsonb WHERE user_id IS NULL AND name = 'Einkommen';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Gehalt', '#2e7d72', '💶', '["gehalt","lohn","bezüge","bezuege","gehaltszahlung","lohnzahlung","honorar","umsatzerlös","umsatzerloes","trinkgeld","auszahlung gewinn"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Einkommen' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"einkommen"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Gehalt');
UPDATE categories SET filters = '["gehalt","lohn","bezüge","bezuege","gehaltszahlung","lohnzahlung","honorar","umsatzerlös","umsatzerloes","trinkgeld","auszahlung gewinn"]'::jsonb, color = '#2e7d72', icon = '💶', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Einkommen' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"einkommen"}'::jsonb WHERE user_id IS NULL AND name = 'Gehalt';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Rente & Soziales', '#2e7d72', '💶', '["rente","deutsche rentenversicherung","betriebsrente","pension","kindergeld","familienkasse","bafög","bafoeg","elterngeld","arbeitslosengeld","agentur für arbeit","agentur fuer arbeit","jobcenter leistung","wohngeld","krankengeld"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Einkommen' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"einkommen"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Rente & Soziales');
UPDATE categories SET filters = '["rente","deutsche rentenversicherung","betriebsrente","pension","kindergeld","familienkasse","bafög","bafoeg","elterngeld","arbeitslosengeld","agentur für arbeit","agentur fuer arbeit","jobcenter leistung","wohngeld","krankengeld"]'::jsonb, color = '#2e7d72', icon = '💶', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Einkommen' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"einkommen"}'::jsonb WHERE user_id IS NULL AND name = 'Rente & Soziales';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Erstattungen', '#2e7d72', '💶', '["erstattung","rückerstattung","rueckerstattung","steuererstattung","finanzamt erstattung"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Einkommen' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"einkommen"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Erstattungen');
UPDATE categories SET filters = '["erstattung","rückerstattung","rueckerstattung","steuererstattung","finanzamt erstattung"]'::jsonb, color = '#2e7d72', icon = '💶', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Einkommen' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"einkommen"}'::jsonb WHERE user_id IS NULL AND name = 'Erstattungen';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Zinserträge', '#2e7d72', '💶', '["zinsen","tagesgeldzinsen","zinsgutschrift"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Einkommen' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"einkommen"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Zinserträge');
UPDATE categories SET filters = '["zinsen","tagesgeldzinsen","zinsgutschrift"]'::jsonb, color = '#2e7d72', icon = '💶', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Einkommen' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"einkommen"}'::jsonb WHERE user_id IS NULL AND name = 'Zinserträge';

-- 🏠 Wohnen
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Wohnen', '#1d5c54', '🏠', '[]'::jsonb, true, NULL, '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Wohnen');
UPDATE categories SET color = '#1d5c54', icon = '🏠', filters = '[]'::jsonb, attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb WHERE user_id IS NULL AND name = 'Wohnen';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Miete & Hausgeld', '#1d5c54', '🏠', '["miete","kaltmiete","warmmiete","nebenkosten","nebenkostenabrechnung","hausgeld","wohnungsgenossenschaft","vonovia","deutsche wohnen","wbg","gwg","leg immobilien","immobilien verwaltung","hausverwaltung","vw immobilien","grundsteuer"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Wohnen' LIMIT 1), '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Miete & Hausgeld');
UPDATE categories SET filters = '["miete","kaltmiete","warmmiete","nebenkosten","nebenkostenabrechnung","hausgeld","wohnungsgenossenschaft","vonovia","deutsche wohnen","wbg","gwg","leg immobilien","immobilien verwaltung","hausverwaltung","vw immobilien","grundsteuer"]'::jsonb, color = '#1d5c54', icon = '🏠', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Wohnen' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb WHERE user_id IS NULL AND name = 'Miete & Hausgeld';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Strom & Energie', '#1d5c54', '🏠', '["stadtwerke","e.on","eon energie","enbw","vattenfall","eprimo","lichtblick","yello strom","rwe","gasag","mainova","naturstrom","polarstern","tibber","octopus energy","lsw energie","lsw","stromnetz"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Wohnen' LIMIT 1), '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Strom & Energie');
UPDATE categories SET filters = '["stadtwerke","e.on","eon energie","enbw","vattenfall","eprimo","lichtblick","yello strom","rwe","gasag","mainova","naturstrom","polarstern","tibber","octopus energy","lsw energie","lsw","stromnetz"]'::jsonb, color = '#1d5c54', icon = '🏠', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Wohnen' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb WHERE user_id IS NULL AND name = 'Strom & Energie';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Wasser & Abwasser', '#1d5c54', '🏠', '["wasserwerk","wasser/abwasser","abwasser","techem","ista","minol"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Wohnen' LIMIT 1), '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Wasser & Abwasser');
UPDATE categories SET filters = '["wasserwerk","wasser/abwasser","abwasser","techem","ista","minol"]'::jsonb, color = '#1d5c54', icon = '🏠', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Wohnen' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb WHERE user_id IS NULL AND name = 'Wasser & Abwasser';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Rundfunkbeitrag', '#1d5c54', '🏠', '["gez","rundfunkbeitrag","ard zdf"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Wohnen' LIMIT 1), '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Rundfunkbeitrag');
UPDATE categories SET filters = '["gez","rundfunkbeitrag","ard zdf"]'::jsonb, color = '#1d5c54', icon = '🏠', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Wohnen' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb WHERE user_id IS NULL AND name = 'Rundfunkbeitrag';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Haushaltswaren', '#1d5c54', '🏠', '["tedox","ikea","möbel","moebel"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Wohnen' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Haushaltswaren');
UPDATE categories SET filters = '["tedox","ikea","möbel","moebel"]'::jsonb, color = '#1d5c54', icon = '🏠', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Wohnen' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Haushaltswaren';

-- 📡 Kommunikation
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Kommunikation', '#3a6ea5', '📡', '[]'::jsonb, true, NULL, '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Kommunikation');
UPDATE categories SET color = '#3a6ea5', icon = '📡', filters = '[]'::jsonb, attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb WHERE user_id IS NULL AND name = 'Kommunikation';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Mobilfunk', '#3a6ea5', '📡', '["o2","telefonica","congstar","mobilfunk","prepaid"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Kommunikation' LIMIT 1), '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Mobilfunk');
UPDATE categories SET filters = '["o2","telefonica","congstar","mobilfunk","prepaid"]'::jsonb, color = '#3a6ea5', icon = '📡', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Kommunikation' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb WHERE user_id IS NULL AND name = 'Mobilfunk';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Internet & TV', '#3a6ea5', '📡', '["vodafone","telekom","1&1","1und1","freenet","kabel","dsl"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Kommunikation' LIMIT 1), '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Internet & TV');
UPDATE categories SET filters = '["vodafone","telekom","1&1","1und1","freenet","kabel","dsl"]'::jsonb, color = '#3a6ea5', icon = '📡', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Kommunikation' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb WHERE user_id IS NULL AND name = 'Internet & TV';

-- 💻 Digitales
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Digitales', '#5a5a8a', '💻', '[]'::jsonb, true, NULL, '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Digitales');
UPDATE categories SET color = '#5a5a8a', icon = '💻', filters = '[]'::jsonb, attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Digitales';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Software & Cloud', '#5a5a8a', '💻', '["adobe","microsoft","microsoft 365","office 365","icloud","google one","apple.com/bill","apple.com bill","dropbox","github"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Digitales' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Software & Cloud');
UPDATE categories SET filters = '["adobe","microsoft","microsoft 365","office 365","icloud","google one","apple.com/bill","apple.com bill","dropbox","github"]'::jsonb, color = '#5a5a8a', icon = '💻', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Digitales' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Software & Cloud';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Webhosting & Domains', '#5a5a8a', '💻', '["strato","webhosting","domain","ionos","hetzner","netcup"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Digitales' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Webhosting & Domains');
UPDATE categories SET filters = '["strato","webhosting","domain","ionos","hetzner","netcup"]'::jsonb, color = '#5a5a8a', icon = '💻', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Digitales' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Webhosting & Domains';

-- 🛒 Lebensmittel
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Lebensmittel', '#8a7d5a', '🛒', '[]'::jsonb, true, NULL, '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Lebensmittel');
UPDATE categories SET color = '#8a7d5a', icon = '🛒', filters = '[]'::jsonb, attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb WHERE user_id IS NULL AND name = 'Lebensmittel';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Supermarkt', '#8a7d5a', '🛒', '["rewe","edeka","aldi","aldi süd","aldi nord","lidl","penny","netto","netto marken-discount","kaufland","real,-","globus","tegut","denns","denn''s","alnatura","bio company","feneberg","hit markt","combi","famila","marktkauf","norma","nah und gut","nahkauf","spar","metro","selgros","picnic","bringmeister","knuspr","flink","gorillas"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Lebensmittel' LIMIT 1), '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Supermarkt');
UPDATE categories SET filters = '["rewe","edeka","aldi","aldi süd","aldi nord","lidl","penny","netto","netto marken-discount","kaufland","real,-","globus","tegut","denns","denn''s","alnatura","bio company","feneberg","hit markt","combi","famila","marktkauf","norma","nah und gut","nahkauf","spar","metro","selgros","picnic","bringmeister","knuspr","flink","gorillas"]'::jsonb, color = '#8a7d5a', icon = '🛒', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Lebensmittel' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb WHERE user_id IS NULL AND name = 'Supermarkt';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Getränkemarkt', '#8a7d5a', '🛒', '["getränke hoffmann","getraenke hoffmann","trinkgut","fristo"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Lebensmittel' LIMIT 1), '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Getränkemarkt');
UPDATE categories SET filters = '["getränke hoffmann","getraenke hoffmann","trinkgut","fristo"]'::jsonb, color = '#8a7d5a', icon = '🛒', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Lebensmittel' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb WHERE user_id IS NULL AND name = 'Getränkemarkt';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Bäckerei', '#8a7d5a', '🛒', '["bäckerei","baeckerei","konditorei","back-factory","backfactory"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Lebensmittel' LIMIT 1), '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Bäckerei');
UPDATE categories SET filters = '["bäckerei","baeckerei","konditorei","back-factory","backfactory"]'::jsonb, color = '#8a7d5a', icon = '🛒', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Lebensmittel' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb WHERE user_id IS NULL AND name = 'Bäckerei';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Metzgerei', '#8a7d5a', '🛒', '["fleischerei","metzgerei"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Lebensmittel' LIMIT 1), '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Metzgerei');
UPDATE categories SET filters = '["fleischerei","metzgerei"]'::jsonb, color = '#8a7d5a', icon = '🛒', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Lebensmittel' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb WHERE user_id IS NULL AND name = 'Metzgerei';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Wochenmarkt', '#8a7d5a', '🛒', '["wochenmarkt","hofladen"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Lebensmittel' LIMIT 1), '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Wochenmarkt');
UPDATE categories SET filters = '["wochenmarkt","hofladen"]'::jsonb, color = '#8a7d5a', icon = '🛒', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Lebensmittel' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb WHERE user_id IS NULL AND name = 'Wochenmarkt';

-- 🍽️ Essen & Trinken
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Essen & Trinken', '#a8845c', '🍽️', '[]'::jsonb, true, NULL, '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Essen & Trinken');
UPDATE categories SET color = '#a8845c', icon = '🍽️', filters = '[]'::jsonb, attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Essen & Trinken';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Restaurant', '#a8845c', '🍽️', '["restaurant","gastronomie","ristorante","l''osteria","losteria","vapiano","nordsee","dean & david","dean&david","five guys","asia bistro","sushi","nem grill","mongus garden","pizzeria","döner","doener","pizza"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Essen & Trinken' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Restaurant');
UPDATE categories SET filters = '["restaurant","gastronomie","ristorante","l''osteria","losteria","vapiano","nordsee","dean & david","dean&david","five guys","asia bistro","sushi","nem grill","mongus garden","pizzeria","döner","doener","pizza"]'::jsonb, color = '#a8845c', icon = '🍽️', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Essen & Trinken' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Restaurant';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Fast Food', '#a8845c', '🍽️', '["mcdonald","mcdonalds","burger king","kfc","subway","imbiss","lieferando","uber eats","wolt"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Essen & Trinken' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Fast Food');
UPDATE categories SET filters = '["mcdonald","mcdonalds","burger king","kfc","subway","imbiss","lieferando","uber eats","wolt"]'::jsonb, color = '#a8845c', icon = '🍽️', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Essen & Trinken' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Fast Food';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Café', '#a8845c', '🍽️', '["café","cafe","bistro","coffee fellows","balzac","tchibo café","starbucks"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Essen & Trinken' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Café');
UPDATE categories SET filters = '["café","cafe","bistro","coffee fellows","balzac","tchibo café","starbucks"]'::jsonb, color = '#a8845c', icon = '🍽️', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Essen & Trinken' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Café';

-- 🚗 Mobilität
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Mobilität', '#5c7a99', '🚗', '[]'::jsonb, true, NULL, '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Mobilität');
UPDATE categories SET color = '#5c7a99', icon = '🚗', filters = '[]'::jsonb, attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Mobilität';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Kraftstoff', '#5c7a99', '🚗', '["tankstelle","tanken","aral","shell","esso","jet","star tankstelle","agip","eni","avia","hem tankstelle","om tankstelle","supermarkt tankstelle","kraftstoff"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Mobilität' LIMIT 1), '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Kraftstoff');
UPDATE categories SET filters = '["tankstelle","tanken","aral","shell","esso","jet","star tankstelle","agip","eni","avia","hem tankstelle","om tankstelle","supermarkt tankstelle","kraftstoff"]'::jsonb, color = '#5c7a99', icon = '🚗', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Mobilität' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb WHERE user_id IS NULL AND name = 'Kraftstoff';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'ÖPNV & Bahn', '#5c7a99', '🚗', '["deutsche bahn","db vertrieb","db fernverkehr","db regio","flixbus","flixtrain","hvv","mvg","mvv","bvg","vbb","vrr","rmv","vvs","kvb","vrs","ddsd"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Mobilität' LIMIT 1), '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'ÖPNV & Bahn');
UPDATE categories SET filters = '["deutsche bahn","db vertrieb","db fernverkehr","db regio","flixbus","flixtrain","hvv","mvg","mvv","bvg","vbb","vrr","rmv","vvs","kvb","vrs","ddsd"]'::jsonb, color = '#5c7a99', icon = '🚗', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Mobilität' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb WHERE user_id IS NULL AND name = 'ÖPNV & Bahn';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'KFZ-Versicherung', '#5c7a99', '🚗', '["kfz-versicherung","kfz versicherung","volkswagen autoversicherung","autoversicherung"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Mobilität' LIMIT 1), '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'KFZ-Versicherung');
UPDATE categories SET filters = '["kfz-versicherung","kfz versicherung","volkswagen autoversicherung","autoversicherung"]'::jsonb, color = '#5c7a99', icon = '🚗', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Mobilität' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb WHERE user_id IS NULL AND name = 'KFZ-Versicherung';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Parken', '#5c7a99', '🚗', '["apcoa","ehc parken","parkhaus","parken","vinci park"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Mobilität' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Parken');
UPDATE categories SET filters = '["apcoa","ehc parken","parkhaus","parken","vinci park"]'::jsonb, color = '#5c7a99', icon = '🚗', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Mobilität' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Parken';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Werkstatt & TÜV', '#5c7a99', '🚗', '["tüv","tuev","dekra","werkstatt","reifen","autoteile","adac"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Mobilität' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Werkstatt & TÜV');
UPDATE categories SET filters = '["tüv","tuev","dekra","werkstatt","reifen","autoteile","adac"]'::jsonb, color = '#5c7a99', icon = '🚗', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Mobilität' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Werkstatt & TÜV';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Carsharing & Taxi', '#5c7a99', '🚗', '["free now","flinkster","share now","miles mobility","uber","taxi"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Mobilität' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Carsharing & Taxi');
UPDATE categories SET filters = '["free now","flinkster","share now","miles mobility","uber","taxi"]'::jsonb, color = '#5c7a99', icon = '🚗', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Mobilität' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Carsharing & Taxi';

-- 💊 Gesundheit
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Gesundheit', '#4a9a8d', '💊', '[]'::jsonb, true, NULL, '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Gesundheit');
UPDATE categories SET color = '#4a9a8d', icon = '💊', filters = '[]'::jsonb, attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Gesundheit';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Apotheke', '#4a9a8d', '💊', '["apotheke","dm apotheke","shop-apotheke","shop apotheke","docmorris","medpex","easyapotheke"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Gesundheit' LIMIT 1), '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Apotheke');
UPDATE categories SET filters = '["apotheke","dm apotheke","shop-apotheke","shop apotheke","docmorris","medpex","easyapotheke"]'::jsonb, color = '#4a9a8d', icon = '💊', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Gesundheit' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb WHERE user_id IS NULL AND name = 'Apotheke';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Arzt & Zahnarzt', '#4a9a8d', '💊', '["arztpraxis","zahnarzt","augenarzt","hausarzt","facharzt","krankenhaus","klinik","labor diagnostik"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Gesundheit' LIMIT 1), '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Arzt & Zahnarzt');
UPDATE categories SET filters = '["arztpraxis","zahnarzt","augenarzt","hausarzt","facharzt","krankenhaus","klinik","labor diagnostik"]'::jsonb, color = '#4a9a8d', icon = '💊', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Gesundheit' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb WHERE user_id IS NULL AND name = 'Arzt & Zahnarzt';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Therapie', '#4a9a8d', '💊', '["physiotherapie","ergotherapie","logopädie","logopaedie"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Gesundheit' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Therapie');
UPDATE categories SET filters = '["physiotherapie","ergotherapie","logopädie","logopaedie"]'::jsonb, color = '#4a9a8d', icon = '💊', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Gesundheit' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Therapie';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Krankenkasse', '#4a9a8d', '💊', '["barmer","aok","techniker krankenkasse","tk krankenkasse","dak","ikk","knappschaft","krankenkasse","private krankenversicherung"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Gesundheit' LIMIT 1), '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Krankenkasse');
UPDATE categories SET filters = '["barmer","aok","techniker krankenkasse","tk krankenkasse","dak","ikk","knappschaft","krankenkasse","private krankenversicherung"]'::jsonb, color = '#4a9a8d', icon = '💊', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Gesundheit' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb WHERE user_id IS NULL AND name = 'Krankenkasse';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Fitnessstudio', '#4a9a8d', '💊', '["fitnessstudio","mcfit","fitx","clever fit","urban sports club","yoga"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Gesundheit' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Fitnessstudio');
UPDATE categories SET filters = '["fitnessstudio","mcfit","fitx","clever fit","urban sports club","yoga"]'::jsonb, color = '#4a9a8d', icon = '💊', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Gesundheit' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Fitnessstudio';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Optiker & Hörgeräte', '#4a9a8d', '💊', '["sehtest","optiker","hörgeräte","hoergeraete","fielmann"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Gesundheit' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Optiker & Hörgeräte');
UPDATE categories SET filters = '["sehtest","optiker","hörgeräte","hoergeraete","fielmann"]'::jsonb, color = '#4a9a8d', icon = '💊', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Gesundheit' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Optiker & Hörgeräte';

-- 🛡️ Versicherungen
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Versicherungen', '#7d8a87', '🛡️', '[]'::jsonb, true, NULL, '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Versicherungen');
UPDATE categories SET color = '#7d8a87', icon = '🛡️', filters = '[]'::jsonb, attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb WHERE user_id IS NULL AND name = 'Versicherungen';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Haftpflicht & Hausrat', '#7d8a87', '🛡️', '["haftpflicht","hausratversicherung","wohngebäudeversicherung","wohngebaeudeversicherung","vgh"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Versicherungen' LIMIT 1), '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Haftpflicht & Hausrat');
UPDATE categories SET filters = '["haftpflicht","hausratversicherung","wohngebäudeversicherung","wohngebaeudeversicherung","vgh"]'::jsonb, color = '#7d8a87', icon = '🛡️', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Versicherungen' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb WHERE user_id IS NULL AND name = 'Haftpflicht & Hausrat';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Lebensversicherung', '#7d8a87', '🛡️', '["lebensversicherung","provinzial","alte leipziger"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Versicherungen' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"sparen"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Lebensversicherung');
UPDATE categories SET filters = '["lebensversicherung","provinzial","alte leipziger"]'::jsonb, color = '#7d8a87', icon = '🛡️', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Versicherungen' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"sparen"}'::jsonb WHERE user_id IS NULL AND name = 'Lebensversicherung';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Sonstige Versicherung', '#7d8a87', '🛡️', '["versicherung","allianz","axa","ergo","debeka","signal iduna","generali","wgv","devk","gothaer","barmenia","hanse merkur","württembergische","wuerttembergische","cosmosdirekt","verti versicherung","ottonova","zurich versicherung","ihre versicherung","r+v versicherung","ruv","lvm versicherung","vhv","continentale","nürnberger versicherung","nuernberger versicherung","beitrag versicherung","huk-coburg","huk24","huk coburg"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Versicherungen' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Sonstige Versicherung');
UPDATE categories SET filters = '["versicherung","allianz","axa","ergo","debeka","signal iduna","generali","wgv","devk","gothaer","barmenia","hanse merkur","württembergische","wuerttembergische","cosmosdirekt","verti versicherung","ottonova","zurich versicherung","ihre versicherung","r+v versicherung","ruv","lvm versicherung","vhv","continentale","nürnberger versicherung","nuernberger versicherung","beitrag versicherung","huk-coburg","huk24","huk coburg"]'::jsonb, color = '#7d8a87', icon = '🛡️', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Versicherungen' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Sonstige Versicherung';

-- 📺 Abos & Streaming
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Abos & Streaming', '#7d6b8a', '📺', '[]'::jsonb, true, NULL, '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Abos & Streaming');
UPDATE categories SET color = '#7d6b8a', icon = '📺', filters = '[]'::jsonb, attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Abos & Streaming';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Streaming', '#7d6b8a', '📺', '["netflix","spotify","amazon prime","disney+","disneyplus","youtube premium","dazn","sky deutschland","wow tv","rtl+","rtl plus","joyn","audible","paramount+","paramount plus","deezer","tidal","crunchyroll"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Abos & Streaming' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Streaming');
UPDATE categories SET filters = '["netflix","spotify","amazon prime","disney+","disneyplus","youtube premium","dazn","sky deutschland","wow tv","rtl+","rtl plus","joyn","audible","paramount+","paramount plus","deezer","tidal","crunchyroll"]'::jsonb, color = '#7d6b8a', icon = '📺', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Abos & Streaming' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Streaming';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Zeitung & Magazine', '#7d6b8a', '📺', '["tagesspiegel abo","spiegel plus","zeitschriftenabo","zeitungsabo"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Abos & Streaming' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Zeitung & Magazine');
UPDATE categories SET filters = '["tagesspiegel abo","spiegel plus","zeitschriftenabo","zeitungsabo"]'::jsonb, color = '#7d6b8a', icon = '📺', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Abos & Streaming' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Zeitung & Magazine';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Sonstige Abos', '#7d6b8a', '📺', '["abo","abonnement","patreon","onlyfans","fitness abo"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Abos & Streaming' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Sonstige Abos');
UPDATE categories SET filters = '["abo","abonnement","patreon","onlyfans","fitness abo"]'::jsonb, color = '#7d6b8a', icon = '📺', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Abos & Streaming' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Sonstige Abos';

-- 💰 Sparen & Investieren
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Sparen & Investieren', '#c2a14d', '💰', '[]'::jsonb, true, NULL, '{"essenziell":false,"ausgabenklasse":"sparen"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Sparen & Investieren');
UPDATE categories SET color = '#c2a14d', icon = '💰', filters = '[]'::jsonb, attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"sparen"}'::jsonb WHERE user_id IS NULL AND name = 'Sparen & Investieren';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Bausparen', '#c2a14d', '💰', '["bausparen","lbs"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Sparen & Investieren' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"sparen"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Bausparen');
UPDATE categories SET filters = '["bausparen","lbs"]'::jsonb, color = '#c2a14d', icon = '💰', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Sparen & Investieren' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"sparen"}'::jsonb WHERE user_id IS NULL AND name = 'Bausparen';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Wertpapiere', '#c2a14d', '💰', '["broker","depot","wertpapier","etf","trade republic","scalable","comdirect"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Sparen & Investieren' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"sparen"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Wertpapiere');
UPDATE categories SET filters = '["broker","depot","wertpapier","etf","trade republic","scalable","comdirect"]'::jsonb, color = '#c2a14d', icon = '💰', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Sparen & Investieren' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"sparen"}'::jsonb WHERE user_id IS NULL AND name = 'Wertpapiere';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Tagesgeld', '#c2a14d', '💰', '["tagesgeld","festgeld","sparbuch"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Sparen & Investieren' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"sparen"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Tagesgeld');
UPDATE categories SET filters = '["tagesgeld","festgeld","sparbuch"]'::jsonb, color = '#c2a14d', icon = '💰', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Sparen & Investieren' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"sparen"}'::jsonb WHERE user_id IS NULL AND name = 'Tagesgeld';

-- 🎲 Freizeit & Hobby
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Freizeit & Hobby', '#b56576', '🎲', '[]'::jsonb, true, NULL, '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Freizeit & Hobby');
UPDATE categories SET color = '#b56576', icon = '🎲', filters = '[]'::jsonb, attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Freizeit & Hobby';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Lotto', '#b56576', '🎲', '["lotto","toto","toto-lotto","eurojackpot"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Freizeit & Hobby' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Lotto');
UPDATE categories SET filters = '["lotto","toto","toto-lotto","eurojackpot"]'::jsonb, color = '#b56576', icon = '🎲', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Freizeit & Hobby' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Lotto';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Vereine', '#b56576', '🎲', '["verein","esports","drk","mitgliedsbeitrag"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Freizeit & Hobby' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Vereine');
UPDATE categories SET filters = '["verein","esports","drk","mitgliedsbeitrag"]'::jsonb, color = '#b56576', icon = '🎲', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Freizeit & Hobby' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Vereine';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Kultur & Museen', '#b56576', '🎲', '["museum","eintritt","kino","theater","konzert"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Freizeit & Hobby' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Kultur & Museen');
UPDATE categories SET filters = '["museum","eintritt","kino","theater","konzert"]'::jsonb, color = '#b56576', icon = '🎲', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Freizeit & Hobby' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Kultur & Museen';

-- 🛍️ Shopping
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Shopping', '#7bb8ac', '🛍️', '[]'::jsonb, true, NULL, '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Shopping');
UPDATE categories SET color = '#7bb8ac', icon = '🛍️', filters = '[]'::jsonb, attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Shopping';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Kleidung', '#7bb8ac', '🛍️', '["h&m","c&a","primark","tk maxx","new yorker","deichmann","takko","kik","zalando","vinted"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Shopping' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Kleidung');
UPDATE categories SET filters = '["h&m","c&a","primark","tk maxx","new yorker","deichmann","takko","kik","zalando","vinted"]'::jsonb, color = '#7bb8ac', icon = '🛍️', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Shopping' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Kleidung';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Drogerie', '#7bb8ac', '🛍️', '["dm-drogerie","dm drogerie","rossmann","müller markt","mueller markt"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Shopping' LIMIT 1), '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Drogerie');
UPDATE categories SET filters = '["dm-drogerie","dm drogerie","rossmann","müller markt","mueller markt"]'::jsonb, color = '#7bb8ac', icon = '🛍️', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Shopping' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":true,"ausgabenklasse":"essenziell"}'::jsonb WHERE user_id IS NULL AND name = 'Drogerie';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Elektronik', '#7bb8ac', '🛍️', '["mediamarkt","saturn","conrad electronic","expert","euronics","notebooksbilliger","apple store"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Shopping' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Elektronik');
UPDATE categories SET filters = '["mediamarkt","saturn","conrad electronic","expert","euronics","notebooksbilliger","apple store"]'::jsonb, color = '#7bb8ac', icon = '🛍️', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Shopping' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Elektronik';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Baumarkt', '#7bb8ac', '🛍️', '["obi","hornbach","bauhaus","toom baumarkt"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Shopping' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Baumarkt');
UPDATE categories SET filters = '["obi","hornbach","bauhaus","toom baumarkt"]'::jsonb, color = '#7bb8ac', icon = '🛍️', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Shopping' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Baumarkt';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Allgemeiner Einzelhandel', '#7bb8ac', '🛍️', '["amazon","amzn","otto","ebay","galeria","thalia","decathlon","tedi","kleinanzeigen","temu","shein","wish","lovoo","buecher.de","bücher.de","real.de"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Shopping' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Allgemeiner Einzelhandel');
UPDATE categories SET filters = '["amazon","amzn","otto","ebay","galeria","thalia","decathlon","tedi","kleinanzeigen","temu","shein","wish","lovoo","buecher.de","bücher.de","real.de"]'::jsonb, color = '#7bb8ac', icon = '🛍️', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Shopping' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Allgemeiner Einzelhandel';

-- 🏨 Reisen
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Reisen', '#d08c45', '🏨', '[]'::jsonb, true, NULL, '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Reisen');
UPDATE categories SET color = '#d08c45', icon = '🏨', filters = '[]'::jsonb, attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Reisen';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Hotels', '#d08c45', '🏨', '["hotel","übernachtung","uebernachtung"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Reisen' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Hotels');
UPDATE categories SET filters = '["hotel","übernachtung","uebernachtung"]'::jsonb, color = '#d08c45', icon = '🏨', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Reisen' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Hotels';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Urlaub & Ausflüge', '#d08c45', '🏨', '["check24 reisen","urlaub","reisebüro","reisebuero","booking.com","airbnb"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Reisen' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Urlaub & Ausflüge');
UPDATE categories SET filters = '["check24 reisen","urlaub","reisebüro","reisebuero","booking.com","airbnb"]'::jsonb, color = '#d08c45', icon = '🏨', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Reisen' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Urlaub & Ausflüge';

-- 🏦 Finanzen
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Finanzen', '#6b7a8f', '🏦', '[]'::jsonb, true, NULL, '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Finanzen');
UPDATE categories SET color = '#6b7a8f', icon = '🏦', filters = '[]'::jsonb, attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Finanzen';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Kontoführung', '#6b7a8f', '🏦', '["kontoführung","kontogebühr","kontofuehrung","kontoführungsgebühr"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Finanzen' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Kontoführung');
UPDATE categories SET filters = '["kontoführung","kontogebühr","kontofuehrung","kontoführungsgebühr"]'::jsonb, color = '#6b7a8f', icon = '🏦', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Finanzen' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Kontoführung';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Kreditkarte', '#6b7a8f', '🏦', '["kreditkartenabrechnung","miles & more","kreditkarte"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Finanzen' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Kreditkarte');
UPDATE categories SET filters = '["kreditkartenabrechnung","miles & more","kreditkarte"]'::jsonb, color = '#6b7a8f', icon = '🏦', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Finanzen' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Kreditkarte';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Gebühren & Zinsen', '#6b7a8f', '🏦', '["dispozinsen","sollzinsen","gebühr","sollzins"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Finanzen' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Gebühren & Zinsen');
UPDATE categories SET filters = '["dispozinsen","sollzinsen","gebühr","sollzins"]'::jsonb, color = '#6b7a8f', icon = '🏦', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Finanzen' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Gebühren & Zinsen';

-- 🔄 Transfers
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Transfers', '#8a8a8a', '🔄', '[]'::jsonb, true, NULL, '{"essenziell":false,"ausgabenklasse":"sparen"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Transfers');
UPDATE categories SET color = '#8a8a8a', icon = '🔄', filters = '[]'::jsonb, attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"sparen"}'::jsonb WHERE user_id IS NULL AND name = 'Transfers';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Eigenübertrag', '#8a8a8a', '🔄', '["umbuchung","eigenübertrag","übertrag","giro"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Transfers' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"sparen"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Eigenübertrag');
UPDATE categories SET filters = '["umbuchung","eigenübertrag","übertrag","giro"]'::jsonb, color = '#8a8a8a', icon = '🔄', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Transfers' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"sparen"}'::jsonb WHERE user_id IS NULL AND name = 'Eigenübertrag';
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Bargeld', '#8a8a8a', '🔄', '["geldautomat","bargeldabhebung","bargeld","atm"]'::jsonb, true, (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Transfers' LIMIT 1), '{"essenziell":false,"ausgabenklasse":"sparen"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Bargeld');
UPDATE categories SET filters = '["geldautomat","bargeldabhebung","bargeld","atm"]'::jsonb, color = '#8a8a8a', icon = '🔄', parent_id = (SELECT id FROM categories WHERE user_id IS NULL AND name = 'Transfers' LIMIT 1), attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"sparen"}'::jsonb WHERE user_id IS NULL AND name = 'Bargeld';

-- 📦 Sonstiges
INSERT INTO categories (name, color, icon, filters, is_default, parent_id, attributes, user_id)
SELECT 'Sonstiges', '#9aa0a6', '📦', '[]'::jsonb, true, NULL, '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb, NULL
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE user_id IS NULL AND name = 'Sonstiges');
UPDATE categories SET color = '#9aa0a6', icon = '📦', filters = '[]'::jsonb, attributes = COALESCE(attributes, '{}'::jsonb) || '{"essenziell":false,"ausgabenklasse":"diskretionaer"}'::jsonb WHERE user_id IS NULL AND name = 'Sonstiges';

