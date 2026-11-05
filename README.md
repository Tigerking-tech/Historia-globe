# Creem Next.js + Prisma Template

A **Next.js App Router** template project for integrating [Creem](https://creem.io) with modern web apps. This template demonstrates how to use the [Creem SDK](https://github.com/armitage-labs/creem-sdk) to implement common subscription and payment flows. Use this as a starting point for your own Creem-powered SaaS or product.

> **Note:** This is a template project. We welcome [issues](https://github.com/armitage-labs/creem-template/issues) for new use cases and [pull requests](https://github.com/armitage-labs/creem-template/pulls) to improve the template!

---

## 🚀 Quickstart

1. **Clone the repository**
2. **Install dependencies** (use your preferred package manager)

   ```bash
   yarn install
   # or
   npm install
   # or
   pnpm install
   ```

3. **Set up your environment variables**

   ```bash
   cp .env.example .env
   # Edit .env and fill in the required variables
   ```

4. **Run database migrations** (creates a local SQLite database)

   ```bash
   yarn prisma migrate dev
   ```

5. **Start the development server**

   ```bash
   yarn dev
   ```

6. **Expose your app to the internet for webhooks**

   To receive webhooks from Creem, you need a reverse proxy. We recommend [NGROK](https://ngrok.com/docs/getting-started/), which is free and easy to set up.

   - [NGROK Documentation](https://ngrok.com/docs/getting-started/)

---

## 📝 Introduction

This template provides a ready-to-use integration with Creem, Prisma, and Next.js App Router. It demonstrates:

- Fetching and displaying all products in your Creem account
- Creating checkout sessions for products
- Fulfilling orders based on the purchasing account
- Handling subscription creation, cancellation, and expiration
- Generating customer portal links for clients with active subscriptions

The codebase is modular, uses TypeScript throughout, and leverages modern React patterns with [Shadcn UI](https://ui.shadcn.com/), [Radix UI](https://www.radix-ui.com/), and [Tailwind CSS](https://tailwindcss.com/).
The template is not taking security into account, so please be careful when using any of its code in production.

---

## 🛠️ Technologies Used

- [Next.js](https://nextjs.org/) – React framework for server-side rendering and static site generation
- [Prisma](https://www.prisma.io/) – Type-safe ORM for database access
- [SQLite](https://www.sqlite.org/) – Lightweight, file-based relational database
- [Creem SDK](https://www.npmjs.com/package/creem) – Subscription and payment integration

---

## 💡 Contributing

- **Request new use cases:** [Create an issue](https://github.com/YOUR_REPO/issues)
- **Improve the template:** [Open a pull request](https://github.com/YOUR_REPO/pulls)

We welcome contributions and feedback from the community!

---

## 📚 Resources

- [Creem SDK Documentation](https://github.com/armitage-labs/creem-sdk)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Shadcn UI](https://ui.shadcn.com/)
- [Radix UI](https://www.radix-ui.com/)
- [Tailwind CSS](https://tailwindcss.com/)

---

## License

MIT
