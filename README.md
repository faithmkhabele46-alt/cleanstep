# Cleanstep Booking System

Cleanstep is a production-focused Next.js booking app for:

- Footwear cleaning
- Carpets cleaning
- Beds, couches and cushions

The app supports:

- step-by-step booking flows
- live pricing
- Google Maps address suggestions
- WhatsApp and Email booking confirmation flows
- separate drop-off and call-out logic

## Local development

Run the dev server:

```bash
npm.cmd run dev
```

Open:

```text
http://localhost:3000
```

## Environment variables

Create `C:\Users\faith\cleanstep\.env.local` from `.env.example` and fill in your real values.

Required for production:

- `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

Needed only if payment/email is used later:

- `PAYSTACK_SECRET_KEY`
- `NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY`
- `RESEND_API_KEY`
- `BOOKINGS_FROM_EMAIL`

## Launch plan

Recommended hosting: Vercel

### 1. Put the project on GitHub

Initialize Git, create a GitHub repo, and push the code.

### 2. Import into Vercel

In Vercel:

- create a new project
- import the GitHub repo
- keep the default Next.js settings

### 3. Add production environment variables

Add the same values from `.env.local` into Vercel project settings.

### 4. Connect your existing domain

In Vercel project settings:

- open `Domains`
- add your real domain
- update DNS records where your domain is managed

### 5. Update external service settings

After deployment, update:

- Google Maps referrer restrictions
- Supabase redirect/site URLs if auth is still used internally
- Paystack callback/site URL if payment is used later

## Notes

- `.env.local` is ignored by Git and should not be committed
- customers do not need signup to use the booking flow
- you can still edit the app after launch by changing code locally and redeploying
