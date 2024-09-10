// Import styles of packages that you've installed.
// All packages except `@mantine/hooks` require styles imports
import '@mantine/core/styles.css';

import { ColorSchemeScript, MantineProvider } from '@mantine/core';
import {ReactNode} from "react";

export const metadata = {
    title: 'LLMでビジネス企画書作成',
    description: 'LLMでビジネス企画書作成するサービスです！',
};

export default function RootLayout({children,}: {
    children: ReactNode;
}) {
    return (
        <html lang="ja">
        <head>
            <ColorSchemeScript />
        </head>
        <body>
        <MantineProvider>{children}</MantineProvider>
        </body>
        </html>
    );
}