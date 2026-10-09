import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Kadaka — AI Marketing Office',description:'Kantor marketing AI dengan tim kreatif, alur kerja nyata, dan kendali manusia. Powered by Claw3D.'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="id"><body>{children}</body></html>;}
