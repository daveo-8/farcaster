import type { Metadata } from 'next';

import '~/app/globals.css';
import { Providers } from '~/app/providers';
import { APP_NAME, APP_DESCRIPTION } from '~/lib/constants';
import {WalletProvider} from "~/lib/wallet-context";
import {Toaster} from "sonner";

export const metadata: Metadata = {
  title: APP_NAME,
  description: APP_DESCRIPTION,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <WalletProvider>
            <Providers>
                {children}
            </Providers>
            <Toaster />
        </WalletProvider>
      </body>
    </html>
  );
}
