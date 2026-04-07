# B3Hub — Screen Inventory

## Mobile (Expo / React Native)

### Auth

| Screen                           | File                             |
| -------------------------------- | -------------------------------- |
| Splash / root redirect           | `app/index.tsx`                  |
| Welcome                          | `app/(auth)/welcome.tsx`         |
| Onboarding                       | `app/(auth)/onboarding.tsx`      |
| Register                         | `app/(auth)/register.tsx`        |
| Login                            | `app/(auth)/login.tsx`           |
| Forgot password                  | `app/(auth)/forgot-password.tsx` |
| Apply for role (seller / driver) | `app/(auth)/apply-role.tsx`      |

### Buyer

| Screen                            | File                                      |
| --------------------------------- | ----------------------------------------- |
| Home                              | `app/(buyer)/home.tsx`                    |
| Catalog (browse materials)        | `app/(buyer)/catalog.tsx`                 |
| New order (material wizard entry) | `app/(buyer)/new-order.tsx`               |
| Orders list                       | `app/(buyer)/orders.tsx`                  |
| Order detail                      | `app/(buyer)/order/[id].tsx`              |
| Transport job detail              | `app/(buyer)/transport-job/[id].tsx`      |
| Skip hire order detail            | `app/(buyer)/skip-order/[id].tsx`         |
| RFQ detail                        | `app/(buyer)/rfq/[id].tsx`                |
| Projects list                     | `app/(buyer)/projects.tsx`                |
| Project detail                    | `app/(buyer)/project/[id].tsx`            |
| New project                       | `app/(buyer)/project/new.tsx`             |
| Framework contracts list          | `app/(buyer)/framework-contracts.tsx`     |
| Framework contract detail         | `app/(buyer)/framework-contract/[id].tsx` |
| Invoices                          | `app/(buyer)/invoices.tsx`                |
| Documents                         | `app/(buyer)/documents.tsx`               |
| Certificates                      | `app/(buyer)/certificates.tsx`            |
| Team                              | `app/(buyer)/team.tsx`                    |
| Saved addresses                   | `app/(buyer)/saved-addresses.tsx`         |
| Disputes                          | `app/(buyer)/disputes.tsx`                |
| Profile                           | `app/(buyer)/profile.tsx`                 |

### Seller (canSell users)

| Screen                    | File                                       |
| ------------------------- | ------------------------------------------ |
| Home                      | `app/(seller)/home.tsx`                    |
| Catalog (my listings)     | `app/(seller)/catalog.tsx`                 |
| Incoming orders           | `app/(seller)/incoming.tsx`                |
| Order detail              | `app/(seller)/order/[id].tsx`              |
| Quote requests            | `app/(seller)/quotes.tsx`                  |
| Framework contracts list  | `app/(seller)/framework-contracts.tsx`     |
| Framework contract detail | `app/(seller)/framework-contract/[id].tsx` |
| Earnings                  | `app/(seller)/earnings.tsx`                |
| Documents                 | `app/(seller)/documents.tsx`               |
| Profile                   | `app/(seller)/profile.tsx`                 |

### Driver (canTransport users)

| Screen           | File                         |
| ---------------- | ---------------------------- |
| Home             | `app/(driver)/home.tsx`      |
| Active job       | `app/(driver)/active.tsx`    |
| Available jobs   | `app/(driver)/jobs.tsx`      |
| Schedule         | `app/(driver)/schedule.tsx`  |
| Skip hire jobs   | `app/(driver)/skips.tsx`     |
| Earnings         | `app/(driver)/earnings.tsx`  |
| Fleet / vehicles | `app/(driver)/vehicles.tsx`  |
| Documents        | `app/(driver)/documents.tsx` |
| Profile          | `app/(driver)/profile.tsx`   |

### Order Wizards

| Screen                          | File                             |
| ------------------------------- | -------------------------------- |
| Material order wizard           | `app/order/index.tsx`            |
| Material order confirmation     | `app/order/confirmation.tsx`     |
| Order request (catalog → order) | `app/order-request-new.tsx`      |
| Transport wizard                | `app/transport/index.tsx`        |
| Transport confirmation          | `app/transport/confirmation.tsx` |
| Disposal wizard                 | `app/disposal/index.tsx`         |
| Disposal confirmation           | `app/disposal/confirmation.tsx`  |

### Global / Shared

| Screen                | File                       |
| --------------------- | -------------------------- |
| Delivery proof upload | `app/delivery-proof.tsx`   |
| Chat (job-scoped)     | `app/chat/[jobId].tsx`     |
| Messages (inbox)      | `app/messages.tsx`         |
| Notifications         | `app/notifications.tsx`    |
| Support chat          | `app/support-chat.tsx`     |
| Leave a review        | `app/review/[orderId].tsx` |
| Settings              | `app/settings.tsx`         |
| Change password       | `app/change-password.tsx`  |
| Help                  | `app/help.tsx`             |

---

## Web (Next.js — seller / admin portal)

### Public / Auth

| Screen                              | Route              |
| ----------------------------------- | ------------------ |
| Landing / home                      | `/`                |
| Login                               | `/(auth)/login`    |
| Register                            | `/(auth)/register` |
| Forgot password                     | `/forgot-password` |
| Reset password                      | `/reset-password`  |
| Apply (seller / carrier onboarding) | `/apply`           |

### Shared Dashboard

| Screen                    | Route                      |
| ------------------------- | -------------------------- |
| Dashboard root            | `/dashboard`               |
| Notifications             | `/dashboard/notifications` |
| Chat                      | `/dashboard/chat`          |
| Documents                 | `/dashboard/documents`     |
| Settings                  | `/dashboard/settings`      |
| Active (live job tracker) | `/dashboard/active`        |
| Analytics                 | `/dashboard/analytics`     |
| Reviews                   | `/dashboard/reviews`       |
| Company profile           | `/dashboard/company`       |
| Company team              | `/dashboard/company/team`  |

### Buyer (web)

| Screen                    | Route                                 |
| ------------------------- | ------------------------------------- |
| Buyer overview            | `/dashboard/buyer`                    |
| Projects                  | `/dashboard/buyer/projects`           |
| Project detail            | `/dashboard/buyer/projects/[id]`      |
| Projects (alt)            | `/dashboard/projects`                 |
| Project detail (alt)      | `/dashboard/projects/[id]`            |
| Orders list               | `/dashboard/orders`                   |
| Order detail              | `/dashboard/orders/[id]`              |
| Order schedules           | `/dashboard/orders/schedules`         |
| Order — materials wizard  | `/dashboard/order/materials`          |
| Order — transport wizard  | `/dashboard/order/transport`          |
| Order — disposal wizard   | `/dashboard/order/disposal`           |
| Order — skip hire         | `/dashboard/order/skip-hire`          |
| Order (legacy entry)      | `/order`                              |
| Invoices                  | `/dashboard/invoices`                 |
| Checkout                  | `/dashboard/checkout`                 |
| Certificates              | `/dashboard/certificates`             |
| Framework contracts list  | `/dashboard/framework-contracts`      |
| Framework contract detail | `/dashboard/framework-contracts/[id]` |
| Quote requests            | `/dashboard/quote-requests`           |
| Open RFQs                 | `/dashboard/quote-requests/open`      |

### Supplier

| Screen                | Route                          |
| --------------------- | ------------------------------ |
| Supplier overview     | `/dashboard/supplier`          |
| Catalog (my listings) | `/dashboard/catalog`           |
| Materials management  | `/dashboard/materials`         |
| Earnings              | `/dashboard/supplier/earnings` |
| Schedule              | `/dashboard/schedule`          |

### Carrier / Transporter

| Screen               | Route                             |
| -------------------- | --------------------------------- |
| Transporter overview | `/dashboard/transporter`          |
| Jobs                 | `/dashboard/jobs`                 |
| Fleet                | `/dashboard/fleet`                |
| Garage               | `/dashboard/garage`               |
| Transport job detail | `/dashboard/transport-jobs/[id]`  |
| Transporter earnings | `/dashboard/transporter/earnings` |
| Driver earnings      | `/dashboard/driver/earnings`      |
| Transporter settings | `/dashboard/transporter/settings` |
| Containers           | `/dashboard/containers`           |
| Container fleet      | `/dashboard/containers/fleet`     |
| Skip hire            | `/dashboard/skip-hire`            |
| Recycling centers    | `/dashboard/recycling-centers`    |

### Admin

| Screen         | Route                           |
| -------------- | ------------------------------- |
| Admin overview | `/dashboard/admin`              |
| Users          | `/dashboard/admin/users`        |
| Companies      | `/dashboard/admin/companies`    |
| Orders         | `/dashboard/admin/orders`       |
| Jobs           | `/dashboard/admin/jobs`         |
| Applications   | `/dashboard/admin/applications` |
| Disputes       | `/dashboard/admin/disputes`     |

---

**Totals:** 55 mobile screens · 60 web pages
