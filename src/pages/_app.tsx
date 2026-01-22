import { type AppType } from "next/app";
import { Geist } from "next/font/google";
import { Toaster } from "sonner";

import { api } from "~/utils/api";
import { AuthProvider } from "~/contexts/AuthContext";
import { ThemeProvider } from "~/contexts/ThemeContext";
import { I18nProvider } from "~/lib/i18n/index";

import "~/styles/globals.css";

const geist = Geist({
  subsets: ["latin"],
});

const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <I18nProvider>
          <div className={geist.className}>
            <Component {...pageProps} />
            <Toaster richColors position="top-right" />
          </div>
        </I18nProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default api.withTRPC(MyApp);
