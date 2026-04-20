export default function LandingPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
      <p>Redirecting to login...</p>
    </main>
  );
}

export async function getServerSideProps() {
  return {
    redirect: {
      destination: "/login",
      permanent: false,
    },
  };
}
