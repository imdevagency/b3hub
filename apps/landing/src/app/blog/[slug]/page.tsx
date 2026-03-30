import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CalendarDays, Clock, ArrowLeft } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { getAllPosts, getPostBySlug } from '@/lib/blog';

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.excerpt,
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  return (
    <>
      <Navbar />
      <main>
        <article className="py-16 sm:py-24">
          <div className="mx-auto max-w-3xl px-6 lg:px-8">
            {/* Back link */}
            <Link
              href="/blog"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-primary transition-colors mb-8"
            >
              <ArrowLeft className="h-4 w-4" />
              Atpakaļ uz blogu
            </Link>

            {/* Header */}
            <header className="mb-10">
              <div className="flex items-center gap-3 text-sm text-gray-500 mb-4">
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
              <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                {post.title}
              </h1>
              <p className="mt-4 text-lg text-gray-600">{post.excerpt}</p>
              <p className="mt-3 text-sm text-gray-500">
                Autors: <span className="font-medium text-gray-700">{post.author}</span>
              </p>
            </header>

            {/* Body */}
            <div className="prose prose-gray max-w-none prose-headings:font-bold prose-a:text-primary">
              {post.body.split('\n\n').map((paragraph, i) => (
                <p key={i} className="text-gray-700 leading-8 mb-6">
                  {paragraph}
                </p>
              ))}
            </div>

            {/* CTA */}
            <div className="mt-16 rounded-2xl bg-primary p-8 text-center">
              <h2 className="text-xl font-bold text-white">Izmēģiniet B3Hub bez maksas</h2>
              <p className="mt-2 text-primary-foreground/80">
                Pievienojieties simtiem uzņēmumu, kas jau optimizē savu darbību.
              </p>
              <Link
                href={`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/register`}
                className="mt-6 inline-block rounded-lg bg-white px-6 py-3 text-sm font-semibold text-primary hover:bg-white/90 transition-colors"
              >
                Sākt bez maksas →
              </Link>
            </div>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
