import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
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
      <main className="bg-background w-full min-h-screen">
        <article className="pt-32 pb-24 md:pt-48 md:pb-32 px-6 lg:px-12 max-w-4xl mx-auto">
          <div className="mb-16">
            {/* Back button */}
            <Link
              href="/blog"
              className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-12 tracking-wide uppercase"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Atgriezties
            </Link>

            {/* Stark Header Meta */}
            <div className="flex items-center gap-4 text-sm font-bold tracking-widest uppercase text-foreground mb-6">
              <span>{post.category}</span>
              <span className="w-1 h-1 bg-border rounded-full" />
              <span className="font-light">
                {new Date(post.date).toLocaleDateString('lv-LV', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </span>
              <span className="w-1 h-1 bg-border rounded-full" />
              <span className="font-light text-muted-foreground">{post.readingTime} min</span>
            </div>

            {/* Huge Headline */}
            <h1 className="text-5xl md:text-7xl font-medium tracking-tighter text-foreground mb-8 leading-[1.05]">
              {post.title}
            </h1>

            {/* Lead paragraph */}
            <p className="text-xl md:text-2xl text-muted-foreground font-light leading-relaxed">
              {post.excerpt}
            </p>

            <div className="mt-8 border-b border-border w-full" />
          </div>

          {/* Minimal Body */}
          <div className="prose prose-lg prose-neutral max-w-none prose-headings:font-medium text-foreground/90 prose-headings:tracking-tight prose-a:text-foreground prose-a:border-b prose-a:border-foreground/30 hover:prose-a:border-foreground transition-colors">
            {post.body.split('\n\n').map((paragraph, i) => (
              <p key={i} className="leading-relaxed font-light text-xl mb-8">
                {paragraph}
              </p>
            ))}
          </div>

          {/* Stark CTA box replacing colored card */}
          <div className="mt-32 pt-16 border-t border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <h2 className="text-3xl font-medium tracking-tight mb-2">Esat gatavi sākt?</h2>
              <p className="text-muted-foreground text-lg">
                Pievienojieties simtiem uzņēmumu B3Hub platformā.
              </p>
            </div>
            <Link
              href={`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001'}/register`}
              className="bg-foreground text-background px-8 py-4 rounded-xl text-lg font-medium hover:scale-105 transition-transform whitespace-nowrap"
            >
              Izveidot lūkumu
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
