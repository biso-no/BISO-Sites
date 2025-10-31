import { cn } from '@repo/ui/lib/utils';
import localFont from 'next/font/local';

export const museoSans = localFont({
  src: '../../public/museo_sans_300.otf',
  variable: '--font-museo',
  display: 'swap',
});