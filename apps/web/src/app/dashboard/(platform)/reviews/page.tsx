/**
 * Reviews page — /dashboard/reviews
 * Buyers: submit a star rating for a recently completed order.
 * Suppliers / carriers: see their received reviews and aggregate score.
 */
'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { getCompanyReviews, createReview } from '@/lib/api';
import { getMyOrders, type ApiOrder } from '@/lib/api/orders';
import { getMySkipHireOrders, type SkipHireOrder } from '@/lib/api/skip-hire';
import { Star, User, Send, CheckCircle } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

interface Review {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  reviewer: { firstName: string; lastName: string };
}

// ── Star picker ───────────────────────────────────────────────────────────────

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          className="p-0.5 focus:outline-none"
        >
          <Star
            className={`h-7 w-7 transition-colors ${
              i <= (hover || value) ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'
            }`}
          />
        </button>
      ))}
    </div>
  );
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

const RATING_LABELS: Record<number, string> = {
  1: 'Ļoti slikti',
  2: 'Slikti',
  3: 'Vidēji',
  4: 'Labi',
  5: 'Izcili',
};

// ── Buyer: submit a review ────────────────────────────────────────────────────

function BuyerReviewView({ token }: { token: string }) {
  const [matOrders, setMatOrders] = useState<ApiOrder[]>([]);
  const [skipOrders, setSkipOrders] = useState<SkipHireOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedSkipId, setSelectedSkipId] = useState('');
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getMyOrders(token), getMySkipHireOrders(token)])
      .then(([mat, skip]) => {
        setMatOrders(mat.filter((o) => o.status === 'DELIVERED'));
        setSkipOrders(skip.filter((o) => o.status === 'COMPLETED' || o.status === 'DELIVERED'));
      })
      .finally(() => setLoading(false));
  }, [token]);

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Lūdzu izvēlieties vērtējumu');
      return;
    }
    if (!selectedOrderId && !selectedSkipId) {
      setError('Lūdzu izvēlieties pasūtījumu');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createReview(
        {
          rating,
          comment: comment.trim() || undefined,
          orderId: selectedOrderId || undefined,
          skipOrderId: selectedSkipId || undefined,
        },
        token,
      );
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Neizdevās saglabāt atsauksmi');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return <div className="py-16 text-center text-muted-foreground text-sm">Ielādē...</div>;

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <CheckCircle className="h-14 w-14 text-green-500" />
        <p className="text-lg font-semibold">Paldies par atsauksmi!</p>
        <p className="text-sm text-muted-foreground">
          Jūsu vērtējums palīdz uzlabot pakalpojumu kvalitāti.
        </p>
        <Button
          variant="outline"
          onClick={() => {
            setDone(false);
            setRating(0);
            setComment('');
            setSelectedOrderId('');
            setSelectedSkipId('');
          }}
        >
          Atstāt vēl vienu atsauksmi
        </Button>
      </div>
    );
  }

  const noOrders = matOrders.length === 0 && skipOrders.length === 0;

  if (noOrders) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-muted-foreground">
        Nav pabeigtu pasūtījumu, kuriem varētu atstāt atsauksmi.
      </div>
    );
  }

  return (
    <div className="max-w-lg space-y-6">
      <p className="text-sm text-muted-foreground">
        Izvēlieties pabeigtu pasūtījumu un novērtējiet piegādātāja vai transporta pakalpojumu.
      </p>

      {/* Order selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Pasūtījums</label>
        <select
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
          value={selectedOrderId || selectedSkipId}
          onChange={(e) => {
            const v = e.target.value;
            const isSkip = skipOrders.some((o) => o.id === v);
            setSelectedSkipId(isSkip ? v : '');
            setSelectedOrderId(isSkip ? '' : v);
          }}
        >
          <option value="">— izvēlieties pasūtījumu —</option>
          {matOrders.map((o) => (
            <option key={o.id} value={o.id}>
              #{o.orderNumber} · Materiāli · {new Date(o.createdAt).toLocaleDateString('lv-LV')}
            </option>
          ))}
          {skipOrders.map((o) => (
            <option key={o.id} value={o.id}>
              #{o.orderNumber} · Konteiners · {new Date(o.createdAt).toLocaleDateString('lv-LV')}
            </option>
          ))}
        </select>
      </div>

      {/* Star picker */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Vērtējums</label>
        <div className="flex items-center gap-3">
          <StarPicker value={rating} onChange={setRating} />
          {rating > 0 && (
            <span className="text-sm font-medium text-amber-600">{RATING_LABELS[rating]}</span>
          )}
        </div>
      </div>

      {/* Comment */}
      <div className="space-y-2">
        <label className="text-sm font-medium">
          Komentārs <span className="text-muted-foreground font-normal">(nav obligāts)</span>
        </label>
        <Textarea
          placeholder="Pastāstiet par savu pieredzi..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground text-right">{comment.length}/500</p>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={handleSubmit} disabled={submitting || rating === 0} className="w-full gap-2">
        <Send className="h-4 w-4" />
        {submitting ? 'Saglabā...' : 'Nosūtīt atsauksmi'}
      </Button>
    </div>
  );
}

// ── Supplier / carrier: received reviews ──────────────────────────────────────

function ReceivedReviewsView({ token, companyId }: { token: string; companyId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCompanyReviews(companyId, token)
      .then((data) => setReviews(data as Review[]))
      .catch(() => setError('Neizdevās ielādēt atsauksmes'))
      .finally(() => setLoading(false));
  }, [token, companyId]);

  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  return (
    <div className="space-y-6">
      {reviews.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-5 flex items-center gap-6">
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReviewsPage() {
  const { user, token } = useAuth();

  if (!token || !user) return null;

  const isSeller = user.canSell || user.canTransport;
  const companyId = user.company?.id;

  // Sellers / carriers see received reviews. Pure buyers see the submit form.
  if (isSeller && companyId) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <PageHeader title="Atsauksmes par uzņēmumu" />
        <ReceivedReviewsView token={token} companyId={companyId} />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <PageHeader title="Atstāt atsauksmi" description="Novērtējiet piegādātāja pakalpojumu" />
      <BuyerReviewView token={token} />
    </div>
  );
}
