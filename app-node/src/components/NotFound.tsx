/**
 * 404 Not Found page component.
 * Renders within 1 second of request receipt per requirement 1.3.
 */
export function NotFound() {
  return (
    <main
      role="main"
      aria-labelledby="not-found-heading"
      style={{ padding: "2rem", textAlign: "center" }}
    >
      <h1 id="not-found-heading">Page Not Found</h1>
      <p>
        Sorry, the page you are looking for does not exist or has been moved.
      </p>
      <p>
        <a href="/" aria-label="Return to DAHLIA homepage">
          Return to Homepage
        </a>
      </p>
    </main>
  )
}
