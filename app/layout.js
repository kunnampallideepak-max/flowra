import './globals.css';
import { AppearanceSync } from './components/appearance';
export const metadata = {
  title: 'Flowra | Water Intelligence',
  description: 'Water intelligence for community operators: monitor synthetic telemetry, explore illustrative networks, understand alerts and plan fair distribution.'
};
export default function RootLayout({
  children
}) {
  return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: `(function(){try{var p=localStorage.getItem('flowra-appearance');if(!['light','dark','system','contrast'].includes(p))p='system';var r=p==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):p;document.documentElement.dataset.appearance=p;document.documentElement.dataset.theme=r}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}})();` }}/></head><body><AppearanceSync/>{children}</body></html>;
}
