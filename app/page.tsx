import "./landing.css";
import AuthForward from "./auth-forward";

const FEATURES = [
  ["I’m having a hard day", "One tap turns the app into a quiet night space: a prayer, a verse, a breath, or someone to call."],
  ["How is your heart today?", "Name what you feel and receive a gentle, honest response, never a diagnosis or a timeline."],
  ["Prayer and Scripture", "Daily prayers written for grief, for when you miss them, can’t sleep, or are angry with God."],
  ["Remember them by name", "Grieving more than one person? Each of them has a place here, and the app speaks of them by name."],
  ["A wave just hit me", "For the song in the store or their handwriting on a card. A breath, a short prayer, and a place to keep the memory."],
  ["Listen when reading is too much", "Morning, evening, and sleep prayers, Scripture, and guided breathing, read aloud slowly while you rest."],
  ["Gentle guides for every season", "Holidays, anniversaries, belongings, returning to work, and guides for losing a spouse, parent, child, sibling, or friend. Open any of them, in any order."],
  ["A keepsake of their life", "Turn the photos, stories, recipes, and sayings in your Memory Vault into a book you can print or have bound."],
  ["Practical and private", "Help with paperwork at your own pace, quiet hours, an app lock, and nothing shared unless you choose."],
];

const FREE = ["“I’m having a hard day” mode", "Daily prayer and Scripture", "Heart check-ins", "Your private journal", "Crisis help, always"];
const PLUS = [
  "A grief companion to talk with, day or night",
  "Your Memory Vault for photos, stories, and songs",
  "An audio library of prayers, Scripture, and sleep prayers, read aloud",
  "Every Grief Journey guide, from holidays to returning to work",
  "A keepsake memory book to save as a PDF or print",
  "Gentle reminders before birthdays and anniversaries, only if you ask",
  "Daily backups for 30 days and a full download of your memories",
];

export default function Landing() {
  return (
    <main className="landing">
      <AuthForward />
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
          <span className="l-navlinks">
            <a className="l-navtext" href="#pricing">Pricing</a>
            <a className="l-navlink" href="/app">Open the app</a>
          </span>
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
            <a className="l-btn ghost" href="#pricing">See pricing</a>
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

      <section className="l-section l-peek">
        <div className="l-peek-text">
          <p className="l-eyebrow dark">A look inside</p>
          <h2>Gentle from the very first screen</h2>
          <p className="l-muted">
            Each morning greets you by name and remembers your loved one by theirs. A Scripture, a prayer, and a way to say how your heart is
            doing are waiting, with the hard-day button always close at hand.
          </p>
          <div className="l-ctas" style={{ justifyContent: "flex-start" }}>
            <a className="l-btn" href="/app">Open the app</a>
          </div>
        </div>
        <figure className="l-phone">
          <picture>
            <source srcSet="/app-home-dark.webp" media="(prefers-color-scheme: dark)" />
            <img
              src="/app-home-light.webp"
              width={600}
              height={1298}
              loading="lazy"
              decoding="async"
              alt="The Still With You home screen: “Good morning, Sarah. We’re thinking about you as you continue remembering Michael,” with an “I’m having a hard day” button, a heart check-in, and today’s Scripture."
            />
          </picture>
        </figure>
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

      <section className="l-section" id="pricing">
        <p className="l-eyebrow dark">Pricing</p>
        <h2>Free to begin. Plus when you want more.</h2>
        <p className="l-muted">The help you need on your hardest day is always free.</p>
        <div className="l-plans">
          <article className="l-plan">
            <h3>Free</h3>
            <p className="l-price">$0 <span>forever</span></p>
            <ul className="l-checks">{FREE.map((f) => <li key={f}>{f}</li>)}</ul>
            <a className="l-btn quiet" href="/app">Start for free</a>
          </article>
          <article className="l-plan plus">
            <span className="l-tag">7 days free</span>
            <h3>Still With You <em>Plus</em></h3>
            <p className="l-price">$6.99 <span>a month</span></p>
            <p className="l-alt">or <strong>$49 a year</strong>, about $4.08 a month</p>
            <p className="l-small">Everything in Free, and:</p>
            <ul className="l-checks">{PLUS.map((f) => <li key={f}>{f}</li>)}</ul>
            <a className="l-btn" href="/app">Try Plus free for 7 days</a>
            <p className="l-small">You won&rsquo;t be charged until your trial ends. Cancel any time.</p>
          </article>
        </div>
      </section>

      <section className="l-section narrow" id="start">
        <p className="l-eyebrow dark">Whenever you&rsquo;re ready</p>
        <h2>Begin today, at your own pace</h2>
        <p className="l-muted">Still With You is open now. It&rsquo;s free to begin, private by default, and here for you on the hard days and the quiet ones.</p>
        <div className="l-ctas" style={{ justifyContent: "flex-start" }}>
          <a className="l-btn" href="/app">Open the app</a>
        </div>
        <p className="l-small">On your phone, add it to your home screen to keep it close.</p>
      </section>

      <footer className="l-footer">
        <p>
          If you are in danger or thinking about ending your life, call or text <strong>988</strong> (US) or your local emergency number.
          Still With You is a companion for reflection and faith. It does not replace counseling, pastoral care, medical care, or crisis services.
        </p>
        <p className="l-footlinks">
          <a href="/privacy">Privacy</a> <span aria-hidden="true">&middot;</span> <a href="/terms">Terms</a> <span aria-hidden="true">&middot;</span> &copy; {new Date().getFullYear()} Still With You
        </p>
      </footer>
    </main>
  );
}
