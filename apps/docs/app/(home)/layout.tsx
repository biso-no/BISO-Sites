import { HomeLayout, HomeLayoutProps } from 'fumadocs-ui/layouts/home';
import { baseOptions } from '../../lib/layout.shared';

export default function Layout({ children }: HomeLayoutProps) {
  return <HomeLayout {...baseOptions()}>{children}</HomeLayout>;
}
