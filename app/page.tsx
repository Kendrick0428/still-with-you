import "./landing.css";
import WaitlistForm from "./waitlist-form";

const FEATURES = [
  ["I’m having a hard day", "One tap turns the app into a quiet night space: a prayer, a verse, a breath, or someone to call."],
  ["How is your heart today?", "Name what you feel and receive a gentle, honest response, never a diagnosis or a timeline."],
  ["Prayer and Scripture", "Daily prayers written for grief, for when you miss them, can’t sleep, or are angry with God."],
  ["Remember them by name", "Grieving more than one person? Each of them has a place here, and the app speaks of them by name."],
  ["A wave just hit me", "For the song in the store or their handwriting on a card. A breath, a short prayer, and a place to keep the memory."],
  ["Practical and private", "Help with paperwork at your own pace, quiet hours, an app lock, and nothing shared unless you choose."],
];

export default function Landing() {
  return (
    <main className="landing">
      <header className="l-hero">
        <div className="l-sky" aria-hidden="true">
          <div className="l-sun" />
          <svg className="l-hills" viewBox="0 0 400 110" preserveAspectRatio="none">
            <path d="M0 62 C70 30 130 44 190 58 S320 34 400 50 V110 H0Z" fill="var(--hill-1)" opacity=".75" />
            <path d="M0 84 C90 60 170 78 250 72 S350 64 400 76 V110 H0Z" fill="var(--hill-2)" />
          </svg>
        </div>
        <nav className="l-nav">
          <span className="l-brand">Still <em>With</em> You</span>
          <a className="l-navlink" href="/app">Open the app</a>
        </nav>
        <div className="l-hero-in">
          <p className="l-eyebrow">A Christian companion for grief</p>
          <h1>You don&rsquo;t have to grieve <em>alone.</em></h1>
          <p className="l-lead">
            Prayer, Scripture, remembrance, and gentle support for anyone who has lost a spouse, child, parent, sibling, or friend.
            At whatever pace you need.
          </p>
          <div className="l-ctas">
            <a className="l-btn" href="/app">Start for free</a>
            <a className="l-btn ghost" href="#waitlist">Join the waitlist</a>
          </div>
        </div>
      </header>

      <section className="l-section">
        <p className="l-eyebrow dark">What&rsquo;s inside</p>
        <h2>Made for the days no one else sees</h2>
        <div className="l-grid">
          {FEATURES.map(([t, d]) => (
            <article key={t} className="l-feature">
              <h3>{t}</h3>
              <p>{d}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="l-quote">
        <blockquote>&ldquo;The LORD is nigh unto them that are of a broken heart.&rdquo;</blockquote>
        <cite>Psalm 34:18 (KJV)</cite>
      </section>

      <section className="l-section narrow">
        <h2>What Still With You will never do</h2>
        <ul className="l-never">
          <li>Tell you how long grief should last, or that you should be &ldquo;over it.&rdquo;</li>
          <li>Send a reminder about a hard date unless you ask for it.</li>
          <li>Share anything you write unless you choose to.</li>
          <li>Pretend to replace your pastor, a counselor, a doctor, or crisis care.</li>
        </ul>
      </section>

      <section className="l-section narrow" id="waitlist">
        <p className="l-eyebrow dark">Early access</p>
        <h2>Be the first to try the full app</h2>
        <p className="l-muted">Audio prayers, the grief companion, and the Memory Vault are on the way. Leave your email and we&rsquo;ll let you know when they&rsquo;re ready.</p>
        <WaitlistForm />
      </section>

      <footer className="l-footer">
        <p>
          If you are in danger or thinking about ending your life, call or text <strong>988</strong> (US) or your local emergency number.
          Still With You is a companion for reflection and faith. It does not replace counseling, pastoral care, medical care, or crisis services.
        </p>
        <p className="l-footlinks">
          <a href="/privacy">Privacy</a> <span aria-hidden="true">&middot;</span> &copy; {new Date().getFullYear()} Still With You
        </p>
      </footer>
    </main>
  );
}
