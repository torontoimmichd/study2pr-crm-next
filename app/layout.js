import './globals.css';import Shell from '../components/Shell';
export const metadata={title:'Study2PR Console',description:'Immigration operations console'};
export default function RootLayout({children}){return(<html lang="en"><body><Shell>{children}</Shell></body></html>);}
