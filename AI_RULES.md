# AI Development Rules

This document outlines the technology stack and the rules for using different libraries in this project. Following these rules ensures consistency, maintainability, and leverages the strengths of our chosen stack.

## Tech Stack

This is a modern web application built with the following technologies:

-   **Framework**: React (with TypeScript) for building the user interface.
-   **Build Tool**: Vite for fast development and optimized builds.
-   **Backend & Database**: Supabase for authentication, database storage, and serverless functions.
-   **Data Fetching**: TanStack Query (React Query) for managing server state, including data fetching, caching, and mutations.
-   **UI Components**: shadcn/ui, a collection of beautifully designed, accessible components built on Radix UI and Tailwind CSS.
-   **Styling**: Tailwind CSS for a utility-first styling approach.
-   **Charting**: Recharts for creating interactive and responsive charts.
-   **Animations**: Framer Motion for fluid and engaging animations.
-   **Icons**: Lucide React for a comprehensive and consistent set of icons.
-   **CSV Handling**: Papaparse for robust client-side CSV file parsing.

## Library Usage Rules

To maintain a clean and consistent codebase, please adhere to the following rules for specific tasks:

### 1. UI Components

-   **Primary Library**: **shadcn/ui**
-   **Rule**: Always use components from `shadcn/ui` (`@/components/ui/...`) when available. This includes buttons, forms, dialogs, cards, etc. Do not create custom components for functionality that already exists in this library.
-   **Customization**: Customize shadcn/ui components using Tailwind CSS utility classes. Avoid overriding their internal styles with custom CSS.

### 2. Styling

-   **Primary Library**: **Tailwind CSS**
-   **Rule**: All styling must be done using Tailwind's utility classes. Do not write custom CSS files or use inline `style` objects unless it's for a dynamic value that cannot be represented by a class.
-   **Consistency**: Use theme values defined in `tailwind.config.js` (e.g., `bg-primary`, `text-destructive`) to maintain a consistent design.

### 3. State Management

-   **Server State**: **TanStack Query**
    -   **Rule**: Use `useQuery` for fetching data and `useMutation` for creating, updating, or deleting data. All interactions with the Supabase backend should be handled through TanStack Query. This provides caching, refetching, and optimistic updates out of the box.
-   **Client State**: **React Hooks**
    -   **Rule**: For local component state, use React's built-in hooks (`useState`, `useReducer`, `useContext`). Avoid introducing complex global state managers like Redux or Zustand unless the application's complexity absolutely requires it.

### 4. Data Fetching & Backend Interaction

-   **Primary Interface**: **Supabase Client & Custom Services**
-   **Rule**: All Supabase calls should be abstracted into functions within the `src/services/` directory (e.g., `transaction-service.ts`). Components should not call the Supabase client directly but instead use these service functions via TanStack Query hooks.

### 5. Charts and Visualizations

-   **Primary Library**: **Recharts**
-   **Rule**: Use `Recharts` for all data visualization needs, including line charts, bar charts, pie charts, and Sankey diagrams. Ensure charts are responsive by wrapping them in `ResponsiveContainer`.

### 6. Animations

-   **Primary Library**: **Framer Motion**
-   **Rule**: Use `Framer Motion` for all UI animations, such as page transitions, list animations, and micro-interactions. This keeps animations consistent and performant.

### 7. Icons

-   **Primary Library**: **Lucide React**
-   **Rule**: Use icons exclusively from the `lucide-react` package to ensure visual consistency across the application.