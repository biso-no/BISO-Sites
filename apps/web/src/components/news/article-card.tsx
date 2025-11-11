import { Calendar, User, ArrowRight } from 'lucide-react';
import { Card } from '@repo/ui/components/ui/card';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { ImageWithFallback } from '@repo/ui/components/image';
import { ContentTranslations } from '@repo/api/types/appwrite';

interface ArticleCardProps {
  article: ContentTranslations;
  variant: 'featured' | 'regular';
}

export const categoryColors: Record<string, string> = {
    'Press Release': 'bg-[#001731]/10 text-[#001731] border-[#001731]/20',
    'Student Life': 'bg-[#3DA9E0]/10 text-[#001731] border-[#3DA9E0]/20',
    'Achievements': 'bg-cyan-100 text-[#001731] border-cyan-200',
  };

export function ArticleCard({ article, variant }: ArticleCardProps) {
  if (variant === 'featured') {
    return (
      <Card className="overflow-hidden border-0 shadow-2xl hover:shadow-3xl transition-all duration-300 group h-full flex flex-col">
        {/* Image */}
        <div className="relative h-80 overflow-hidden">
          <ImageWithFallback
            src={article.news_ref?.image || ''}
            alt={article.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/70 via-transparent to-transparent" />
          <Badge className={`absolute top-4 left-4 ${categoryColors[article.content_type]}`}>
            {article.content_type}
          </Badge>
          <div className="absolute bottom-4 left-4 right-4">
            <h3 className="text-2xl font-bold text-white mb-2">{article.title}</h3>
            <div className="flex items-center gap-4 text-white/80 text-sm">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>{article.news_ref?.$createdAt}</span>
              </div>
              <div className="flex items-center gap-1">
                <User className="w-4 h-4" />
                <span>{article.news_ref?.author}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 flex flex-col grow">
          <p className="text-gray-600 mb-4 grow">{article.description}</p>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">{article.news_ref?.$createdAt}</span>
            <Button className="bg-linear-to-r from-[#3DA9E0] to-[#001731] hover:from-[#3DA9E0]/90 hover:to-[#001731]/90 text-white border-0">
              Read More
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-all duration-300 group h-full flex flex-col">
      {/* Image */}
      <div className="relative h-56 overflow-hidden">
        <ImageWithFallback
          src={article.news_ref?.image || ''}
          alt={article.title}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
        <Badge className={`absolute top-4 left-4 ${categoryColors[article.content_type]}`}>
          {article.content_type}
        </Badge>
      </div>

      {/* Content */}
      <div className="p-6 flex flex-col grow">
        <h3 className="text-xl font-bold mb-3 text-gray-900 line-clamp-2">{article.title}</h3>
        <p className="text-gray-600 mb-4 grow line-clamp-3">{article.description}</p>

        <div className="space-y-3">
          <div className="flex items-center gap-4 text-gray-500 text-sm">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4 text-[#3DA9E0]" />
              <span>{article.news_ref?.$createdAt}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 text-gray-500 text-sm">
            <User className="w-4 h-4 text-[#3DA9E0]" />
            <span>{article.news_ref?.author}</span>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-sm text-gray-500">{article.news_ref?.$createdAt}</span>
            <Button 
              variant="ghost" 
              size="sm"
              className="text-[#3DA9E0] hover:text-[#001731] hover:bg-[#3DA9E0]/10"
            >
              Read More
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}