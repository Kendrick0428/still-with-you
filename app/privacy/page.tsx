import "../landing.css";

export const metadata = { title: "Privacy · Still With You" };

export default function Privacy() {
  return (
    <main className="landing">
      <section className="l-section narrow l-prose">
        <a className="l-back" href="/">&larr; Still With You</a>
        <h1>Privacy</h1>
        <p>Grief is personal. This early version of Still With You is built so that what you write stays with you.</p>
        <h2>Without an account</h2>
        <p>Your name, the names of the people you are grieving, check-ins, notes, and settings are saved only in this browser on this device. We don&rsquo;t receive them. Clearing your browser data removes them.</p>
        <h2>With a free account</h2>
        <p>If you create an account, those same entries are saved to our secure database (hosted by Supabase) so they&rsquo;re safe and available on your other devices. Each account can only ever read its own entries. Your app lock code is never uploaded. You can delete everything saved to your account at any time from Privacy and settings in the app.</p>
        <h2>If you subscribe to Plus</h2>
        <p>Payments are handled by Stripe. Your card details go straight to Stripe and never reach us. We share only your account email with Stripe so your plan is linked to you, and we never share anything you&rsquo;ve written in the app.</p>
        <h2>What else we collect</h2>
        <p>If you join the waitlist, we store your email address so we can tell you when new features are ready. We don&rsquo;t sell or share your information, and you can ask us to delete it at any time.</p>
        <h2>Care, not a substitute for care</h2>
        <p>Still With You does not replace counseling, pastoral care, medical care, or crisis services. If you are in danger, call or text 988 (US) or your local emergency number.</p>
        <p className="l-muted">This page describes the current early version and will be updated, with a full privacy policy, before accounts or cloud backup are introduced.</p>
      </section>
    </main>
  );
}
