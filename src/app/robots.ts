import { MetadataRoute } from 'next';
import { getAppUrl } from '@/lib/app-config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/api/', '/_next/', '/static/'],
    },
    sitemap: `${getAppUrl()}/sitemap.xml`,
  };
}
