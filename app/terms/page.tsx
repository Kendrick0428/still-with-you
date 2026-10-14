import "../landing.css";
import { LEGAL } from "../../lib/legal";

export const metadata = { title: "Terms of Service · Still With You" };

export default function Terms() {
  return (
    <main className="landing">
      <section className="l-section narrow l-prose">
        <a className="l-back" href="/">&larr; Still With You</a>
        <h1>Terms of Service</h1>
        <p className="l-muted">Last updated {LEGAL.updated}</p>
        <p>These terms are an agreement between you and Still With You (&ldquo;we&rdquo; or &ldquo;us&rdquo;) about using the app and website at {LEGAL.site}. By using Still With You, you agree to them. If you don&rsquo;t agree, please don&rsquo;t use the app.</p>

        <h2>What Still With You is, and what it is not</h2>
        <p>Still With You is a Christian companion for people who are grieving. It offers prayers, Scripture, journaling, reflection, remembrance, and an AI grief companion.</p>
        <p><strong>Still With You does not replace professional care.</strong> It is not therapy, counseling, pastoral counseling, medical care, a crisis service, or an emergency service, and nothing in it is medical, psychological, or legal advice. The grief companion is a computer program, not a person, counselor, or pastor. It can be wrong, and it cannot know your full situation or act on your behalf.</p>
        <p><strong>If you are in danger or thinking about ending your life, call or text 988 (US) or your local emergency number right away.</strong> Please don&rsquo;t rely on the app in an emergency.</p>

        <h2>Who can use it</h2>
        <p>You must be at least 18 years old to create an account or subscribe. You&rsquo;re responsible for keeping your password private and for activity on your account.</p>

        <h2>Your words and memories belong to you</h2>
        <p>Everything you write or add (journal entries, letters, check-ins, photos, recordings, and memories) stays yours. You give us only the permission we need to store it, show it back to you, and run the features you choose, such as sending a message to the grief companion so it can reply. We don&rsquo;t sell your content or use it for advertising. Our <a href="/privacy">Privacy Policy</a> explains how it is handled.</p>
        <p>Please only add photos, recordings, and other material you have the right to keep, and don&rsquo;t use the app to harm anyone or break the law.</p>

        <h2>Still With You Plus</h2>
        <p>Some features need a paid Plus subscription, currently $6.99 a month or $49 a year in US dollars. Payments are processed by Stripe.</p>
        <ul>
          <li><strong>Free trial.</strong> First-time subscribers get a 7-day free trial. If you don&rsquo;t cancel before it ends, your chosen plan starts and you are charged.</li>
          <li><strong>Automatic renewal.</strong> Your subscription renews automatically each month or year at the then-current price until you cancel. We&rsquo;ll tell you before any price change.</li>
          <li><strong>Cancelling.</strong> You can cancel any time in the app under Privacy and settings, then Manage my plan. Plus stays on until the end of the period you&rsquo;ve paid for.</li>
          <li><strong>Refunds.</strong> Payments are generally non-refundable except where the law requires, but if something went wrong, write to us and we&rsquo;ll do our best to make it right.</li>
          <li><strong>If Plus ends,</strong> you can still open the memories you saved. Adding new ones needs Plus.</li>
        </ul>
        <p>Hard-day mode, the daily prayer, journaling, and crisis help are free for everyone.</p>

        <h2>Changes and availability</h2>
        <p>We&rsquo;re a small ministry-minded team and the app will keep growing. We may change or retire features, and the service may sometimes be unavailable. If we make an important change to these terms, we&rsquo;ll let you know in the app or by email before it takes effect.</p>

        <h2>Ending your account</h2>
        <p>You can stop using Still With You at any time and delete your saved data from Privacy and settings. We may suspend accounts that misuse the service or break these terms.</p>

        <h2>Limits of our responsibility</h2>
        <p>The app is provided &ldquo;as is.&rdquo; To the fullest extent the law allows, we don&rsquo;t promise it will be error-free or always available, and we aren&rsquo;t liable for indirect or consequential losses. Our total liability to you is limited to the amount you paid us in the 12 months before the claim. Some places don&rsquo;t allow these limits, so they may not apply to you.</p>

        <h2>Contact</h2>
        <p>Questions about these terms? Write to <a href={`mailto:${LEGAL.contact}`}>{LEGAL.contact}</a>.</p>
      </section>
    </main>
  );
}
