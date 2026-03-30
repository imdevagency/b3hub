import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays, Clock, ArrowRight } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { getAllPosts } from '@/lib/blog';

export const metadata: Metadata = {
  title: 'Blogs',
  description:
    'B3Hub blogs — nozares padomi, loģistikas raksti un jaunumi no celtniecības platformas komandas.',
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <>
      <Navbar />
      <main>
        <section className="bg-gray-50 py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
                B3Hub Blogs
              </h1>
              <p className="mt-6 text-lg leading-8 text-gray-600">
                Nozares padomi, loģistikas ieskati un jaunumi no celtniecības platformas komandas.
              </p>
            </div>

            <div className="mx-auto max-w-4xl space-y-8">
              {posts.map((post) => (
                <article
                  key={post.slug}
                  className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3 text-sm text-gray-500 mb-3">
                    <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-medium text-primary">
                      {post.category}
                    </span>
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-4 w-4" />
                      {new Date(post.date).toLocaleDateString('lv-LV', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {post.readingTime} min lasīšana
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-900 mb-3">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="hover:text-primary transition-colors"
                    >
                      {post.title}
                    </Link>
                  </h2>
                  <p className="text-gray-600 leading-7">{post.excerpt}</p>
                  <Link
                    href={`/blog/${post.slug}`}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:gap-2 transition-all"
                  >
                    Lasīt vairāk <ArrowRight className="h-4 w-4" />
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
