import { createContext, useContext } from "react";

export type Page = "home" | "history" | "dictionary" | "snippets" | "settings";

/** Go to a page; "add" asks it to focus its add field, "model" opens Settings → Model. */
export type Navigate = (page: Page, want?: "add" | "model") => void;

export const NavContext = createContext<Navigate>(() => {});

export const useNav = () => useContext(NavContext);
