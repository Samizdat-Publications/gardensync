// Stand-in for a screen still being built.
export function Placeholder({ title }: { title: string }) {
  return (
    <main class="placeholder">
      <h1 tabIndex={-1}>{title}</h1>
      <p class="muted">This screen is being built.</p>
    </main>
  );
}
