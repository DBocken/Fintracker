import type { Category } from "../types";
import { getKeywordsFor } from "../data/merchant-keywords";

/**
 * Standard-Kategorien für den anonymen Modus (kein Supabase-Zugriff).
 * Die Filter werden vom bestehenden Keyword-Matching in
 * transaction-service.categorizeTransaction (case-insensitive) genutzt.
 *
 * IDs sind stabil, damit Transaktionen ihre Zuordnung über Sessions behalten.
 */
export const DEFAULT_LOCAL_CATEGORIES: Category[] = [
  {
    id: "local-cat-einkommen",
    user_id: null,
    name: "Einkommen",
    color: "#2e7d72",
    icon: "💶",
    filters: getKeywordsFor("Einkommen"),
    is_default: true,
    parent_id: null,
  },
  {
    id: "local-cat-wohnen",
    user_id: null,
    name: "Wohnen",
    color: "#1d5c54",
    icon: "🏠",
    filters: getKeywordsFor("Wohnen"),
    is_default: true,
    parent_id: null,
  },
  {
    id: "local-cat-lebensmittel",
    user_id: null,
    name: "Lebensmittel",
    color: "#8a7d5a",
    icon: "🛒",
    filters: getKeywordsFor("Lebensmittel"),
    is_default: true,
    parent_id: null,
  },
  {
    id: "local-cat-mobilitaet",
    user_id: null,
    name: "Mobilität",
    color: "#5c7a99",
    icon: "🚗",
    filters: getKeywordsFor("Mobilität"),
    is_default: true,
    parent_id: null,
  },
  {
    id: "local-cat-restaurant",
    user_id: null,
    name: "Restaurant & Café",
    color: "#a8845c",
    icon: "🍽️",
    filters: getKeywordsFor("Restaurant & Café"),
    is_default: true,
    parent_id: null,
  },
  {
    id: "local-cat-versicherung",
    user_id: null,
    name: "Versicherungen",
    color: "#7d8a87",
    icon: "🛡️",
    filters: getKeywordsFor("Versicherungen"),
    is_default: true,
    parent_id: null,
  },
  {
    id: "local-cat-abos",
    user_id: null,
    name: "Abos & Streaming",
    color: "#7d6b8a",
    icon: "📺",
    filters: getKeywordsFor("Abos & Streaming"),
    is_default: true,
    parent_id: null,
  },
  {
    id: "local-cat-gesundheit",
    user_id: null,
    name: "Gesundheit",
    color: "#4a9a8d",
    icon: "💊",
    filters: getKeywordsFor("Gesundheit"),
    is_default: true,
    parent_id: null,
  },
  {
    id: "local-cat-shopping",
    user_id: null,
    name: "Shopping",
    color: "#7bb8ac",
    icon: "🛍️",
    filters: getKeywordsFor("Shopping"),
    is_default: true,
    parent_id: null,
  },
  {
    id: "local-cat-sonstiges",
    user_id: null,
    name: "Sonstiges",
    color: "#7d8a87",
    icon: "📦",
    filters: getKeywordsFor("Sonstiges"),
    is_default: true,
    parent_id: null,
  },
];
