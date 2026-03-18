'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getCompanyReviews } from '@/lib/api';
import { Star, User } from 'lucide-react';

interface Review {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  reviewer: { firstName: string; lastName: string };
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`}
        />
      ))}
      <span className="ml-1 text-sm font-medium text-muted-foreground">{rating}/5</span>
    </div>
  );
}

export default function ReviewsPage() {
  const { user, token } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const companyId = user?.company?.id;

  useEffect(() => {
    if (!token || !companyId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    getCompanyReviews(companyId, token)
      .then((data) => {
        setReviews(data as Review[]);
        setLoading(false);
      })
      .catch(() => {
        setError('Neizdevās ielādēt atsauksmes');
        setLoading(false);
      });
  }, [token, companyId]);

  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  if (!companyId) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-4">Atsauksmes</h1>
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          Atsauksmes ir pieejamas tikai uzņēmumiem. Vispirms izveidojiet savu uzņēmuma profilu.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Atsauksmes par uzņēmumu</h1>

      {/* Summary card */}
      {reviews.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 mb-6 flex items-center gap-6">
          <div className="text-center">
            <p className="text-4xl font-bold">{avgRating.toFixed(1)}</p>
            <StarRating rating={Math.round(avgRating)} />
            <p className="text-xs text-muted-foreground mt-1">{reviews.length} atsauksmes</p>
          </div>
          <div className="flex-1 space-y-1">
            {[5, 4, 3, 2, 1].map((star) => {
              const count = reviews.filter((r) => r.rating === star).length;
              const pct = reviews.length ? (count / reviews.length) * 100 : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-xs">
                  <span className="w-3 text-right text-muted-foreground">{star}</span>
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-amber-400 h-full rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-4 text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reviews list */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Ielādē...</div>
      ) : error ? (
        <div className="text-center py-12 text-destructive">{error}</div>
      ) : reviews.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
          Jūsu uzņēmumam vēl nav atsauksmju
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <div key={review.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      {review.reviewer.firstName} {review.reviewer.lastName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(review.createdAt).toLocaleDateString('lv-LV', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                </div>
                <StarRating rating={review.rating} />
              </div>
              {review.comment && (
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {review.comment}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
