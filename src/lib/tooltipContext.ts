import { createContext, useContext } from "react";

/** True = tooltips visible; false = tooltips suppressed globally. */
export const TooltipsContext = createContext<boolean>(true);
export const useTooltipsEnabled = () => useContext(TooltipsContext);
