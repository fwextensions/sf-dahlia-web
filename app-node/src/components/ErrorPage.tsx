/**
 * Error page component displayed when data fetching fails
 * after all retries are exhausted and no cached data is available.
 *
 * Provides a retry button that re-initiates the request.
 * Requirements: 3.8, 10.5
 */

interface ErrorPageProps {
  /** Optional title for the error page */
  title?: string
  /** Optional description message */
  message?: string
  /** Called when the user clicks the retry button */
  onRetry?: () => void
}

export function ErrorPage({
  title = "Service Temporarily Unavailable",
  message = "We're having trouble loading this page. Please try again in a moment.",
  onRetry,
}: ErrorPageProps) {
  const handleRetry = () => {
    if (onRetry) {
      onRetry()
    } else {
      // Default behavior: reload the page (which will re-run the loader)
      window.location.reload()
    }
  }

  return (
    <main
      role="main"
      aria-labelledby="error-title"
      className="error-page"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "50vh",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h1 id="error-title">{title}</h1>
      <p style={{ marginTop: "1rem", maxWidth: "40rem" }}>{message}</p>
      <button
        type="button"
        onClick={handleRetry}
        aria-label="Retry loading this page"
        style={{
          marginTop: "1.5rem",
          padding: "0.75rem 2rem",
          fontSize: "1rem",
          cursor: "pointer",
          borderRadius: "4px",
          border: "1px solid #0077da",
          backgroundColor: "#0077da",
          color: "#fff",
        }}
      >
        Try Again
      </button>
    </main>
  )
}
