import Link from "next/link";
import { Shell } from "../lib/layout";

export default function ErrorPage() {
  return (
    <Shell title="Something went wrong" subtitle="Use this fallback route for handled failures.">
      <section className="card">
        <p className="muted">The app redirected here due to a handled error state.</p>
        <div className="row" style={{ marginTop: 12 }}>
          <Link href="/dashboard"><button className="primary">Go to Dashboard</button></Link>
          <Link href="/login"><button>Login again</button></Link>
        </div>
      </section>
    </Shell>
  );
}
