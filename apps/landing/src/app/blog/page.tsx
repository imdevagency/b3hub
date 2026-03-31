import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import { Hero } from '@/components/layout/Hero';
import { Container } from '@/components/layout/Container';
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
      <main className="bg-background w-full min-h-screen">
        <Hero
          eyebrow="Blogs"
          title={
            <>
              Vēstis & <br /> Ieskati.
            </>
          }
          subtitle="Celtniecības loģistika, platformas jaunumi un viedokļi no B3Hub komandas."
        />

        <Container as="section" className="py-24">
          <div className="flex flex-col border-t border-border">
            {posts.map((post) => (
              <article
                key={post.slug}
                className="relative group border-b border-border py-12 flex flex-col md:flex-row gap-4 md:gap-12 items-start hover:bg-muted/30 transition-colors -mx-6 px-6 lg:-mx-12 lg:px-12"
              >
                {/* Meta column */}
                <div className="md:w-1/4 flex md:flex-col items-center md:items-start gap-3 md:gap-2 text-muted-foreground md:pt-2">
                  <span className="text-sm font-bold tracking-widest uppercase text-foreground">
                    {post.category}
                  </span>
                  <span className="hidden md:block w-4 h-px bg-border my-1" />
                  <span className="text-sm font-light">
                    {new Date(post.date).toLocaleDateString('lv-LV', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="text-sm font-light before:content-['•'] before:mr-3 md:before:hidden">
                    {post.readingTime} min
                  </span>
                </div>

                {/* Content column */}
                <div className="md:w-3/4 flex flex-col gap-4">
                  <h2 className="text-3xl md:text-4xl font-medium tracking-tight text-foreground transition-colors">
                    <Link href={`/blog/${post.slug}`} className="focus:outline-none">
                      <span className="absolute inset-0 z-10" aria-hidden="true" />
                      {post.title}
                    </Link>
                  </h2>
                  <p className="text-lg text-muted-foreground font-light leading-relaxed max-w-2xl">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center text-primary font-medium mt-2 opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300">
                    Lasīt vairāk <ArrowRight className="ml-2 w-5 h-5" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </main>
      <Footer />
    </>
  );
}
