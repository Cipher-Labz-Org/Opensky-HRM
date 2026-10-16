type AppTopbarProps = {
  title: string;
  subtitle?: string;
};

/**
 * Page title strip — matches the OpenSky glass page head
 * (eyebrow + display title). Module pages keep their own actions.
 */
export function AppTopbar({ title }: AppTopbarProps) {
  return (
    <div className="osky-phead">
      <div>
        <span className="osky-eyebrow">
          <i aria-hidden />
          OpenSky HRM · live
        </span>
        <h1>{title}</h1>
      </div>
    </div>
  );
}
