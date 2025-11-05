import { listNews } from '@/app/actions/news';
import { getLocale } from '@/app/actions/locale';
import { NewsClient } from './news-client';

export async function NewsSection() {
  const locale = await getLocale();
  
  const news = await listNews({
    locale,
    status: 'published',
    limit: 3,
  });

  return <NewsClient news={news} />;
}

