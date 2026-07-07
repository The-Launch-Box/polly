"use client";

import { createContext, useContext } from "react";
import {
  DEFAULT_THEME_ID,
  getCompanyTheme,
  themeCssVariables,
  type CompanyTheme,
} from "@/lib/company-themes";

const SurveyThemeContext = createContext<CompanyTheme>(
  getCompanyTheme(DEFAULT_THEME_ID),
);

export function SurveyThemeProvider({
  themeId,
  children,
}: {
  themeId: string;
  children: React.ReactNode;
}) {
  const theme = getCompanyTheme(themeId);

  return (
    <SurveyThemeContext.Provider value={theme}>
      <div className="survey-theme min-h-full" style={themeCssVariables(theme)}>
        {children}
      </div>
    </SurveyThemeContext.Provider>
  );
}

export function useSurveyTheme(): CompanyTheme {
  return useContext(SurveyThemeContext);
}
