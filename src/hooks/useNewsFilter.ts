import { useState, useMemo } from 'react';
import type { Article, Category } from '../types';

export function useNewsFilter(articles: Article[]) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category>('Todos');

  const filtered = useMemo(() => {
    return articles.filter((article) => {
      const matchesCategory =
        activeCategory === 'Todos' || article.category === activeCategory;
      const matchesSearch =
        search === '' ||
        article.title.toLowerCase().includes(search.toLowerCase()) ||
        article.excerpt.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [articles, search, activeCategory]);

  return { search, setSearch, activeCategory, setActiveCategory, filtered };
}
