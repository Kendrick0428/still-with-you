import "../landing.css";
import { LEGAL } from "../../lib/legal";

export const metadata = { title: "Privacy Policy · Still With You" };

export default function Privacy() {
  return (
    <main className="landing">
      <section className="l-section narrow l-prose">
        <a className="l-back" href="/">&larr; Still With You</a>
        <h1>Privacy Policy</h1>
        <p className="l-muted">Last updated {LEGAL.updated}</p>
        <p>Grief is personal. Still With You is built so that what you write stays with you. This policy explains what we collect, why, and the choices you have.</p>

        <h2>The short version</h2>
        <ul>
          <li>Your entries are private by default. Only you can see them.</li>
          <li>We never sell your information or use what you write for advertising.</li>
          <li>We never send a message to anyone in your support circle unless you tap Send.</li>
          <li>You can delete what&rsquo;s saved to your account at any time.</li>
        </ul>

        <h2>Without an account</h2>
        <p>Your name, the names of the people you are grieving, check-ins, journal entries, letters, and settings are saved only in this browser on this device. We don&rsquo;t receive them. Clearing your browser data removes them.</p>

        <h2>With a free account</h2>
        <p>We store your email address and a secure, encrypted form of your password so you can sign in. Your entries are saved to our database, hosted by Supabase, so they&rsquo;re safe and available on your other devices. Each account can only ever read its own entries. Your app lock code is never uploaded.</p>

        <h2>Memory Vault</h2>
        <p>Photos, recordings, and other files you add to your Memory Vault are kept in private storage that only your account can open.</p>

        <h2>The grief companion</h2>
        <p>When you write to the grief companion, your message and the recent conversation are sent to Anthropic, the company that provides the AI, so it can write a reply. Anthropic processes them to respond and does not use them to train its models. Your conversation history is kept on your device, not in our database. Please don&rsquo;t share details you&rsquo;d rather keep entirely to yourself, such as account numbers.</p>

        <h2>If you subscribe to Plus</h2>
        <p>Payments are handled by Stripe. Your card details go straight to Stripe and never reach us. We share only your account email with Stripe so your plan is linked to you, and we never share anything you&rsquo;ve written in the app. We can see your plan, its status, and payment amounts so we can run the service.</p>

        <h2>Other things we collect</h2>
        <p>If you join the waitlist, we store your email address so we can tell you when new features are ready. Like most websites, our hosting provider (Vercel) keeps basic technical logs such as IP address and browser type to keep the site secure and working. We count companion messages per account each day to keep the service fair.</p>

        <h2>Who helps us run Still With You</h2>
        <p>We use a small number of trusted service providers, only for the purposes above: Vercel (hosting), Supabase (accounts and storage), Stripe (payments), Anthropic (the grief companion), and Upstash (the waitlist and usage counts). We may also share information if the law requires it or to protect someone&rsquo;s safety.</p>

        <h2>Your choices</h2>
        <p>You can delete everything saved to your account from Privacy and settings in the app, copy your saved data, or write to us to delete your account entirely, unsubscribe from the waitlist, or ask what we hold about you. We&rsquo;ll respond within 30 days.</p>

        <h2>Children</h2>
        <p>Still With You is meant for adults 18 and older. We don&rsquo;t knowingly collect information from children under 13. If you believe a child has given us information, please write to us and we&rsquo;ll delete it.</p>

        <h2>Security</h2>
        <p>Information is encrypted in transit, and access to each account&rsquo;s data is restricted to that account. No system is perfectly secure, but we work to protect what you trust us with.</p>

        <h2>Changes</h2>
        <p>If we make an important change to this policy, we&rsquo;ll let you know in the app or by email before it takes effect.</p>

        <h2>Care, not a substitute for care</h2>
        <p>Still With You does not replace counseling, pastoral care, medical care, or crisis services. If you are in danger, call or text 988 (US) or your local emergency number.</p>

        <h2>Contact</h2>
        <p>Questions about your privacy? Write to <a href={`mailto:${LEGAL.contact}`}>{LEGAL.contact}</a>.</p>
      </section>
    </main>
  );
}
